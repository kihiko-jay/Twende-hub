// supabase/functions/mpesa-webhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Types for clarity ---

type MpesaCallback = {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
};

function extractMpesaFields(payload: MpesaCallback) {
  const cb = payload?.Body?.stkCallback;
  if (!cb) throw new Error("Invalid M-Pesa callback body");

  const items = cb.CallbackMetadata?.Item ?? [];
  const find = (name: string) =>
    items.find((i) => i.Name === name)?.Value ?? null;

  const amount = Number(find("Amount") ?? 0);
  const mpesaReceipt = (find("MpesaReceiptNumber") ?? "") as string;
  const phoneNumber = String(find("PhoneNumber") ?? "");
  const transactionDate = String(find("TransactionDate") ?? "");

  return {
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    amount,
    mpesaReceipt,
    phoneNumber,
    transactionDate,
  };
}

// Constant-time comparison to avoid timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// HMAC-SHA256 verification using raw request body
async function verifySignature(
  rawBody: string,
  providedSig: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !providedSig) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const macBytes = new Uint8Array(mac);

  // Convert to hex string
  const expectedSig = Array.from(macBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expectedSig, providedSig.toLowerCase());
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("MPESA_WEBHOOK_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error("Missing Supabase or webhook env vars");
    return new Response("Server misconfigured", { status: 500 });
  }

  // Read raw body once for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-mpesa-signature");

  // 1) Verify callback authenticity
  const validSignature = await verifySignature(rawBody, signature, webhookSecret);
  if (!validSignature) {
    console.warn("Invalid M-Pesa signature");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: MpesaCallback;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error("Invalid JSON from M-Pesa", e);
    return new Response("Bad Request", { status: 400 });
  }

  const {
    merchantRequestId,
    checkoutRequestId,
    resultCode,
    resultDesc,
    amount,
    mpesaReceipt,
    phoneNumber,
    transactionDate,
  } = extractMpesaFields(payload);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Idempotency + matching:
  // We treat MpesaReceiptNumber as unique provider_payment_id for M-Pesa.
  // payments.payment_provider = 'mpesa'
  // payments.provider_payment_id = mpesaReceipt
  try {
    // 2) Look up the payment row
    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .select("*")
      .eq("payment_provider", "mpesa")
      .eq("provider_payment_id", mpesaReceipt)
      .maybeSingle();

    if (paymentErr) {
      console.error("Error fetching payment", paymentErr);
      return new Response("Server error", { status: 500 });
    }

    if (!payment) {
      // Unknown receipt: log and return 200 so M-Pesa doesn't keep retrying,
      // but you can monitor admin_logs for investigation.
      await supabase.from("admin_logs").insert({
        admin_id: null,
        action: "mpesa_webhook_unknown_receipt",
        entity_type: "payment",
        entity_id: null,
        metadata: {
          mpesaReceipt,
          merchantRequestId,
          checkoutRequestId,
          resultCode,
          resultDesc,
          amount,
          phoneNumber,
          transactionDate,
          raw: payload,
        },
      });
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted (unknown receipt)" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Optional: sanity-check amount matches expected payment.amount
    if (Number(payment.amount) !== amount) {
      console.warn("Amount mismatch for payment", {
        paymentId: payment.id,
        expected: payment.amount,
        actual: amount,
      });

      await supabase.from("admin_logs").insert({
        admin_id: null,
        action: "mpesa_webhook_amount_mismatch",
        entity_type: "payment",
        entity_id: payment.id,
        metadata: {
          mpesaReceipt,
          expectedAmount: payment.amount,
          mpesaAmount: amount,
          phoneNumber,
          transactionDate,
        },
      });

      // You can choose to reject here (500) or accept and flag for review.
      return new Response("Amount mismatch", { status: 400 });
    }

    // 3) Idempotency: if already confirmed or refunded, just log and return 200
    if (payment.payment_status === "confirmed" || payment.payment_status === "refunded") {
      await supabase.from("admin_logs").insert({
        admin_id: null,
        action: "mpesa_webhook_duplicate",
        entity_type: "payment",
        entity_id: payment.id,
        metadata: {
          mpesaReceipt,
          payment_status: payment.payment_status,
          merchantRequestId,
          checkoutRequestId,
          resultCode,
          resultDesc,
        },
      });

      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Already processed" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 4) If M-Pesa indicates failure, mark payment failed (no booking update)
    if (resultCode !== 0) {
      const { data: failedPayment, error: failErr } = await supabase
        .rpc("mark_payment_failed", {
          p_payment_id: payment.id,
          p_error_code: String(resultCode),
          p_error_message: resultDesc,
        });

      if (failErr) {
        console.error("Error marking payment failed", failErr);
        return new Response("Server error", { status: 500 });
      }

      await supabase.from("admin_logs").insert({
        admin_id: null,
        action: "mpesa_payment_failed",
        entity_type: "payment",
        entity_id: payment.id,
        metadata: {
          mpesaReceipt,
          resultCode,
          resultDesc,
          phoneNumber,
          transactionDate,
        },
      });

      // M-Pesa expects 200 even on failure acknowledgement
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Failure acknowledged" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5) Success path: update payment_status = confirmed and booking_status = paid
    // We assume:
    // - payment.booking_id (UUID) references bookings.id
    // - optional payment.booking_type if you have multiple booking tables; then adapt RPC call.
    const bookingId = payment.booking_id;
    if (!bookingId) {
      console.error("Payment missing booking_id", payment.id);
      return new Response("Server error", { status: 500 });
    }

    // If you have the mark_payment_confirmed RPC from your booking state machine:
    // const { data: confirmedPayment, error: confirmErr } = await supabase.rpc(
    //   "mark_payment_confirmed",
    //   { p_payment_id: payment.id, p_booking_type: "standard", p_booking_id: bookingId },
    // );

    // If you DON'T have that RPC, do both updates inside Postgres (preferred),
    // but since Supabase JS doesn't expose transactions directly, we rely on the RPC.
    const { data: confirmedPayment, error: confirmErr } = await supabase.rpc(
      "mark_payment_confirmed",
      {
        p_payment_id: payment.id,
        p_booking_type: payment.booking_type ?? "standard",
        p_booking_id: bookingId,
      },
    );

    if (confirmErr) {
      console.error("Error confirming payment / booking", confirmErr);
      return new Response("Server error", { status: 500 });
    }

    // 6) Log event in admin_logs
    await supabase.from("admin_logs").insert({
      admin_id: null,
      action: "mpesa_payment_confirmed",
      entity_type: "payment",
      entity_id: payment.id,
      metadata: {
        mpesaReceipt,
        booking_id: bookingId,
        amount,
        phoneNumber,
        transactionDate,
        merchantRequestId,
        checkoutRequestId,
        resultCode,
        resultDesc,
      },
    });

    // 7) Return proper HTTP response expected by M-Pesa
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Unhandled M-Pesa webhook error", e);
    // Return 500 so M-Pesa can retry, but function is idempotent on second run
    return new Response("Server error", { status: 500 });
  }
});