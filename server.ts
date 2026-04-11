import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import jwt from "jsonwebtoken";
import path from "path";
import http from "http";
import compression from "compression";
import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import config from "./src/config.js";
import { supabaseServer } from "./src/lib/supabaseServer.js";
import {
  sendEmail,
  paymentReceiptEmail,
  vehicleBookingRequestEmail,
  photographerBookingRequestEmail,
  bookingConfirmationEmail,
  activityRequestJoinEmail,
  activityRequestConvertedEmail,
} from "./src/lib/email.js";
import { applyApprovedPaymentEffects, extractMpesaReceipt, normalizePaymentStatus } from "./src/server/paymentService.js";
import { registerAdminRoutes } from "./src/server/adminRoutes.js";
import { getManualReviewType, isValidKenyanPhone, normalizeKenyanPhone } from "./src/server/paymentUtils.js";
import { registerPayoutRoutes } from "./src/server/payoutRoutes.js";
import type { AuthedRequest } from "./src/server/types.js";

const supabase = supabaseServer as any;


async function finalizeParticipantBookingPayment(payment: { id: number; event_id: number; user_id: string }) {
  const { error } = await supabase.rpc("finalize_attendee_payment_by_server", {
    p_event_id: payment.event_id,
    p_user_id: payment.user_id,
    p_payment_id: payment.id,
  });
  if (error) throw error;
}

async function getMpesaAccessToken() {
  if (!config.mpesaEnabled) {
    throw new Error("M-Pesa is not configured. Please set MPESA_* env vars.");
  }
  const auth = Buffer.from(
    `${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`
  ).toString("base64");
  const res = await fetch(
    `${config.mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to get M-Pesa access token: ${res.status}`);
  }
  const data = (await res.json()) as any;
  return data.access_token as string;
}

function buildMpesaPassword(shortCode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");
}

async function getAdminUser(req: AuthedRequest) {
  if (!req.user || req.user.role !== 'admin') {
    throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  }
  return req.user;
}

async function logPayoutTraffic(payload: {
  payout_id?: number | null;
  direction: string;
  endpoint: string;
  status_code: number;
  payload: any;
  error?: string | null;
}) {
  await supabase.from('payout_logs').insert({
    payout_id: payload.payout_id ?? null,
    direction: payload.direction,
    endpoint: payload.endpoint,
    status_code: payload.status_code,
    payload: payload.payload,
    error: payload.error ?? null,
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const corsOrigins = config.corsOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors(
      corsOrigins.length === 0
        ? {
            origin: config.isProd ? [] : "*",
          }
        : {
            origin: corsOrigins,
          }
    )
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  // --- Security headers (CSP, basic hardening) ---
  app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0");

    // In development, don't enforce CSP so Vite's client scripts work.
    if (!config.isProd) {
      return next();
    }

    const nonce = crypto.randomBytes(16).toString("base64");
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.cspNonce = nonce;
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://images.unsplash.com https://picsum.photos",
      "connect-src 'self' https://ofymavvwnqldipzetivb.supabase.co",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ");
    res.setHeader("Content-Security-Policy", csp);
    next();
  });

  // --- Shared API rate limiting ---
  type RateEntry = { count: number; resetAt: number };
  const rateLimitStore = new Map<string, RateEntry>();
  const RATE_WINDOW_MS = 60_000;
  const RATE_LIMIT = 120;

  let ratelimit: Ratelimit | null = null;
  if (config.redisEnabled) {
    const redis = new Redis({ url: config.upstashRedisUrl, token: config.upstashRedisToken });
    ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '60 s') });
  }

  app.use('/api', async (req: any, res, next) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (ratelimit) {
      const result = await ratelimit.limit(`api:${ip}`);
      if (!result.success) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
      }
      return next();
    }

    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    if (!entry || entry.resetAt < now) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return next();
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  });

  // --- Supabase JWT auth middleware (for payment + optional future routes) ---
  const authenticateSupabase = async (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);
    if (!config.supabaseJwtSecret) {
      console.error("SUPABASE_JWT_SECRET is required for authenticated routes");
      return res.sendStatus(503);
    }
    try {
      const payload = jwt.verify(token, config.supabaseJwtSecret) as { sub?: string };
      const userId = payload?.sub;
      if (!userId) return res.sendStatus(403);
      const { data: profile, error } = await supabase
        .from("users")
        .select("id, name, email, role, phone")
        .eq("id", userId)
        .single();
      if (error || !profile) return res.sendStatus(403);
      req.user = profile;
      next();
    } catch {
      return res.sendStatus(403);
    }
  };

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
    });
    next();
  });

  // Health check (Supabase)
  app.get("/health", async (req, res) => {
    try {
      if (config.supabaseUrl && config.supabaseServiceRoleKey) {
        await supabase.from("events").select("id").limit(1).maybeSingle();
      }
      res.json({ status: "ok", env: config.nodeEnv });
    } catch (e) {
      res.status(500).json({ status: "error", env: config.nodeEnv });
    }
  });

  // --- Payment routes (Supabase-backed) ---
  app.post("/api/payments/initiate", authenticateSupabase, async (req: any, res) => {
    const { event_id, type = "creation", phone, phone_number } = req.body;

    const amount =
      type === "feature"
        ? 500
        : type === "creation"
        ? 1000
        : type === "participant"
        ? Number(req.body.amount ?? 0)
        : 1000;

    if (type === "participant" && (amount <= 0 || Number.isNaN(amount))) {
      return res.status(400).json({ error: "Invalid participant fee amount" });
    }

    const { data: event, error: eventErr } =
      type === "participant"
        ? await supabase
            .from("events")
            .select("id, status")
            .eq("id", event_id)
            .eq("status", "active")
            .single()
        : await supabase
            .from("events")
            .select("id")
            .eq("id", event_id)
            .eq("organizer_id", req.user.id)
            .single();
    if (eventErr || !event) return res.status(404).json({ error: "Event not found or unauthorized" });
    const msisdn = phone_number || phone || req.user.phone;
    if (!msisdn) return res.status(400).json({ error: "Phone number is required for M-Pesa payment" });
    if (!isValidKenyanPhone(msisdn)) {
      return res.status(400).json({ error: "Provide a valid Kenyan Safaricom phone number" });
    }

    // Development / sandbox: simulate an asynchronous approval to exercise the full flow.
    if (!config.isProd || !config.mpesaEnabled) {
      const checkoutId = `MOCK-${event_id}-${Date.now()}`;
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          user_id: req.user.id,
          event_id: Number(event_id),
          amount,
          transaction_reference: checkoutId,
          payment_status: "pending",
          payment_type: type || "creation",
        })
        .select("id, event_id, user_id, payment_type")
        .single();
      if (payErr || !payment) {
        return res.status(500).json({ error: "Failed to create payment record" });
      }

      // After a short delay, auto-approve the payment and drive the same post-payment logic
      // that the real M-Pesa callback uses. This runs in the background and does not block the response.
      setTimeout(async () => {
        try {
          await supabase
            .from("payments")
            .update({ payment_status: "confirmed", processed_at: new Date().toISOString() })
            .eq("id", payment.id);
          await applyApprovedPaymentEffects(supabase, payment, finalizeParticipantBookingPayment);
        } catch (e: any) {
          console.error("Error auto-confirming mock payment", e?.message || e);
        }
      }, 3000);

      return res.json({
        checkout_request_id: checkoutId,
        message: "Dev mode: payment auto-approved in 3 seconds",
        eventId: event_id,
        paymentStatus: "pending",
        amount,
        phone: msisdn,
      });
    }

    // Production: real M-Pesa STK push.
    const reference = `EVT-${event_id}-${Date.now()}`;
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        user_id: req.user.id,
        event_id: Number(event_id),
        amount,
        transaction_reference: reference,
        payment_status: "pending",
        payment_type: type || "creation",
      })
      .select("id")
      .single();
    if (payErr || !payment) return res.status(500).json({ error: "Failed to create payment record" });

    try {
      const accessToken = await getMpesaAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
      const password = buildMpesaPassword(config.mpesaShortCode, config.mpesaPasskey, timestamp);
      const stkBody = {
        BusinessShortCode: config.mpesaShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: msisdn,
        PartyB: config.mpesaShortCode,
        PhoneNumber: msisdn,
        CallBackURL: config.mpesaCallbackUrl,
        AccountReference: "TwendeHub",
        TransactionDesc:
          type === "feature"
            ? "Event feature fee"
            : type === "participant"
            ? "Event participant booking fee"
            : "Event creation fee",
      };

      const stkRes = await fetch(`${config.mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(stkBody),
      });
      const stkData = (await stkRes.json()) as any;

      await supabase.from("payment_logs").insert({
        direction: "outgoing",
        endpoint: "/mpesa/stkpush/v1/processrequest",
        status_code: stkRes.status,
        payload: stkBody as any,
        headers: null,
        error: !stkRes.ok ? JSON.stringify(stkData) : null,
        payment_id: payment.id,
      });

      if (!stkRes.ok || stkData.ResponseCode !== "0") {
        console.error("M-Pesa STK error", stkData);
        return res.status(502).json({ error: "Failed to initiate M-Pesa payment" });
      }

      const checkoutId = stkData.CheckoutRequestID as string | undefined;
      if (checkoutId) {
        await supabase
          .from("payments")
          .update({ transaction_reference: checkoutId })
          .eq("id", payment.id);
      }

      res.json({
        checkout_request_id: checkoutId || null,
        message: "Check your phone for the M-Pesa prompt",
        eventId: event_id,
        paymentStatus: "pending",
        amount,
        phone: msisdn,
      });
    } catch (e: any) {
      console.error("Error initiating M-Pesa payment", e?.message || e);
      res.status(502).json({ error: "Failed to initiate M-Pesa payment" });
    }
  });

  app.post("/api/payments/mpesa-callback", async (req: any, res) => {
    try {
      const rawBody = req.body;
      const callback = rawBody?.Body?.stkCallback;
      if (!callback) return res.status(400).json({ error: "Invalid callback payload" });

      if (config.isProd && !config.mpesaWebhookSecret) {
        return res.status(503).json({ error: 'Webhook verification not configured' });
      }

      // Optional in development, mandatory in production.
      if (config.mpesaWebhookSecret) {
        const signature = (req.headers["x-mpesa-signature"] as string) || "";
        const expected = crypto
          .createHmac("sha256", config.mpesaWebhookSecret)
          .update(JSON.stringify(rawBody))
          .digest("hex");
        if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          console.error("M-Pesa callback signature verification failed");
          return res.status(400).json({ error: "Invalid signature" });
        }
      }

      const checkoutId = callback.CheckoutRequestID as string;
      const resultCode = callback.ResultCode as number;
      const resultDesc = callback.ResultDesc as string;

      const { data: paymentRow } = await supabase
        .from("payments")
        .select("id, event_id, user_id, amount, payment_type, payment_status, provider_payment_id")
        .eq("transaction_reference", checkoutId)
        .single();

      const pay = paymentRow as {
        id: number;
        event_id: number;
        user_id: string;
        amount: number;
        payment_type: string;
        payment_status: string;
        provider_payment_id: string | null;
      } | null;

      await supabase.from("payment_logs").insert({
        direction: "incoming",
        endpoint: "/api/payments/mpesa-callback",
        status_code: 200,
        payload: rawBody,
        headers: req.headers as any,
        error: null,
        payment_id: pay?.id ?? null,
      });

      if (!pay) {
        console.error("Payment not found for CheckoutRequestID", checkoutId);
        return res.json({ ResultCode: 0, ResultDesc: "Received" });
      }

      // Idempotency: if the payment is already in a terminal state, just ACK.
      if (pay.payment_status === "confirmed" || pay.payment_status === "refunded" || pay.payment_status === "failed") {
        return res.json({ ResultCode: 0, ResultDesc: "Already processed" });
      }

      if (resultCode === 0) {
        const mpesaReceipt = extractMpesaReceipt(rawBody);
        await supabase
          .from("payments")
          .update({
            payment_status: "confirmed",
            processed_at: new Date().toISOString(),
            raw_payload: rawBody,
            provider_payment_id: mpesaReceipt ?? pay.provider_payment_id,
          })
          .eq("id", pay.id);

        await applyApprovedPaymentEffects(supabase, pay, finalizeParticipantBookingPayment);

        if (pay.payment_type === "participant") {

          (async () => {
            try {
              const { data: userRow } = await supabase
                .from("users")
                .select("email")
                .eq("id", pay.user_id)
                .single();
              const { data: eventRow } = await supabase
                .from("events")
                .select("title, date_time, location")
                .eq("id", pay.event_id)
                .single();

              const email = (userRow as { email: string } | null)?.email;
              const eventTitle = (eventRow as { title: string; date_time: string; location: string } | null)
                ?.title;
              const eventDate = (eventRow as { title: string; date_time: string; location: string } | null)
                ?.date_time;
              const eventLocation = (eventRow as { title: string; date_time: string; location: string } | null)
                ?.location;

              if (email && eventTitle && eventDate && eventLocation) {
                const payload = bookingConfirmationEmail(email, {
                  eventTitle,
                  eventDate: new Date(eventDate).toLocaleString("en-KE", {
                    dateStyle: "full",
                    timeStyle: "short",
                  }),
                  eventLocation,
                  bookingType: "Event Participation",
                });
                await sendEmail(payload.to, payload.subject, payload.html);
              }
            } catch (e: any) {
              console.error("Failed to send booking confirmation email", e?.message || e);
            }
          })();
        }

        // Fire-and-forget payment receipt email
        (async () => {
          try {
            const { data: userRow } = await supabase
              .from("users")
              .select("email")
              .eq("id", pay.user_id)
              .single();
            const { data: eventRow } = await supabase
              .from("events")
              .select("title")
              .eq("id", pay.event_id)
              .single();
            const email = (userRow as { email: string } | null)?.email;
            const title = (eventRow as { title: string } | null)?.title;
            if (email && title) {
              const payload = paymentReceiptEmail(email, {
                eventTitle: title,
                amount: pay.amount,
                mpesaReceipt: mpesaReceipt ?? pay.provider_payment_id ?? "",
                type: pay.payment_type,
              });
              await sendEmail(payload.to, payload.subject, payload.html);
            }
          } catch (e: any) {
            console.error("Failed to send payment receipt email", e?.message || e);
          }
        })();
      } else {
        await supabase
          .from("payments")
          .update({
            payment_status: "failed",
            processed_at: new Date().toISOString(),
            error_code: String(resultCode),
            error_message: resultDesc,
            raw_payload: rawBody,
          })
          .eq("id", pay.id);

        if (pay.payment_type === "creation") {
          await supabase.rpc("fail_event_creation_payment", {
            p_event_id: pay.event_id,
            p_error_code: String(resultCode),
            p_error_message: resultDesc,
          });
        }
      }

      // M-Pesa requires a fast 200 OK style ACK.
      res.json({ ResultCode: 0, ResultDesc: "Success" });
    } catch (e: any) {
      console.error("Error handling M-Pesa callback", e?.message || e);
      res.json({ ResultCode: 0, ResultDesc: "Received" });
    }
  });

  // Polling endpoint used by the new payment UI.
  app.get("/api/payments/status/:checkout_request_id", authenticateSupabase, async (req: any, res) => {
    const checkoutId = req.params.checkout_request_id as string | undefined;
    if (!checkoutId) return res.status(400).json({ error: "checkout_request_id is required" });

    const { data: payment, error } = await supabase
      .from("payments")
      .select("id, user_id, event_id, payment_type, payment_status, transaction_reference, provider_payment_id")
      .eq("transaction_reference", checkoutId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Failed to lookup payment" });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const row = payment as {
      user_id: string;
      event_id: number;
      payment_type: string;
      payment_status: string;
      provider_payment_id: string | null;
    };

    if (row.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }

    // Map internal statuses to a simpler pending/success/failed contract for the UI.
    const status = normalizePaymentStatus(row.payment_status);

    res.json({
      status,
      type: row.payment_type,
      event_id: row.event_id,
      booking_id: null,
      mpesa_receipt_number: row.provider_payment_id,
    });
  });

  app.get("/api/payments/status", authenticateSupabase, async (req: any, res) => {
    const eventId = parseInt(req.query.event_id as string, 10);
    if (!eventId) return res.status(400).json({ error: "event_id is required" });
    const { data: event } = await supabase
      .from("events")
      .select("status")
      .eq("id", eventId)
      .eq("organizer_id", req.user.id)
      .single();
    if (!event) return res.status(404).json({ error: "Event not found or unauthorized" });
    const { data: payment } = await supabase
      .from("payments")
      .select("payment_status, amount")
      .eq("event_id", eventId)
      .eq("payment_type", "creation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ev = event as { status: string };
    const payRow = payment as { payment_status?: string; amount?: number } | null;
    res.json({
      event_status: ev.status,
      payment_status: payRow?.payment_status ?? null,
      amount: payRow?.amount ?? null,
    });
  });

  app.post("/api/payments/verify", authenticateSupabase, async (req: any, res) => {
    const { event_id, transaction_code, amount, phone_number, type } = req.body ?? {};
    const paymentType = getManualReviewType(type);

    if (!transaction_code || !amount || !phone_number) {
      return res.status(400).json({
        error: "transaction_code, amount, and phone_number are required for manual payment review",
      });
    }

    if (!isValidKenyanPhone(phone_number)) {
      return res.status(400).json({ error: "Provide a valid Kenyan phone number" });
    }

    const eventQuery = supabase.from("events").select("id, organizer_id, status").eq("id", event_id);
    const { data: event } = paymentType === "participant"
      ? await eventQuery.eq("status", "active").single()
      : await eventQuery.eq("organizer_id", req.user.id).single();

    if (!event) return res.status(404).json({ error: "Event not found or unauthorized" });
    if (paymentType === "participant" && Number(amount) <= 0) {
      return res.status(400).json({ error: "Participant payment amount must be greater than zero" });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: req.user.id,
        event_id: Number(event_id),
        amount: Number(amount),
        transaction_reference: transaction_code,
        payment_status: "manual_review_required",
        payment_type: paymentType,
        provider_payment_id: transaction_code,
        payment_provider: "mpesa-manual-review",
        raw_payload: {
          review_source: "manual_verify_endpoint",
          phone_number,
          submitted_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    if (paymentError || !payment) {
      return res.status(500).json({ error: "Failed to create manual review payment" });
    }

    await supabase.from("payment_logs").insert({
      direction: "incoming",
      endpoint: "/api/payments/verify",
      status_code: 202,
      payload: { event_id, transaction_code, amount, phone_number, payment_type: paymentType, review_status: "manual_review_required" },
      headers: null,
      error: null,
      payment_id: payment.id,
    });

    return res.status(202).json({
      status: "manual_review_required",
      payment_id: payment.id,
      message: "Manual verification submitted for admin review.",
    });
  });


  // --- Cancellation and refund eligibility helpers ---
  app.get("/api/events/:id/can-cancel", authenticateSupabase, async (req: any, res) => {
    const eventId = parseInt(req.params.id, 10);
    if (!eventId) return res.status(400).json({ error: "Invalid event id" });

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventId)
      .single();
    if (eventErr || !event) return res.status(404).json({ error: "Event not found" });

    const isOwner = (event as { organizer_id: string }).organizer_id === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Not allowed" });

    const { data, error } = await supabase.rpc("is_event_cancellable", {
      p_event_id: eventId,
    });
    if (error) return res.status(500).json({ error: "Failed to evaluate" });
    res.json({ can_cancel: Boolean(data) });
  });

  app.get("/api/payments/:id/can-refund", authenticateSupabase, async (req: any, res) => {
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) return res.status(400).json({ error: "Invalid payment id" });

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can check refund eligibility" });
    }

    const { data, error } = await supabase.rpc("is_payment_refundable", {
      p_payment_id: paymentId,
    });
    if (error) return res.status(500).json({ error: "Failed to evaluate" });
    res.json({ can_refund: Boolean(data) });
  });

  // --- Booking notification email helpers ---
  app.post("/api/vehicle-bookings/:id/notify", authenticateSupabase, async (req: any, res) => {
    const bookingId = parseInt(req.params.id, 10);
    if (!bookingId) return res.status(400).json({ error: "Invalid booking id" });
    try {
      const { data, error } = await supabase
        .from("vehicle_bookings")
        .select(
          `
            id,
            notes,
            events ( title ),
            vehicles ( make, model, owner:users!vehicles_owner_id_fkey ( email ) ),
            organizer:users!vehicle_bookings_organizer_id_fkey ( name )
          `,
        )
        .eq("id", bookingId)
        .single();
      if (error || !data) return res.status(404).json({ error: "Booking not found" });
      const row = data as any;
      const ownerEmail = Array.isArray(row.vehicles?.owner)
        ? row.vehicles.owner[0]?.email
        : row.vehicles?.owner?.email;
      if (!ownerEmail) return res.json({ status: "ok" });
      const vehicleDesc = `${row.vehicles?.make ?? ""} ${row.vehicles?.model ?? ""}`.trim();
      const payload = vehicleBookingRequestEmail(ownerEmail, {
        vehicleDesc,
        eventTitle: row.events?.title ?? "Your event",
        organizerName: row.organizer?.name ?? "An organiser",
        notes: row.notes ?? null,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: "ok" });
    } catch (e: any) {
      console.error("Failed to send vehicle booking email", e?.message || e);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/photographer-bookings/:id/notify", authenticateSupabase, async (req: any, res) => {
    const bookingId = parseInt(req.params.id, 10);
    if (!bookingId) return res.status(400).json({ error: "Invalid booking id" });
    try {
      const { data, error } = await supabase
        .from("photographer_bookings")
        .select(
          `
            id,
            notes,
            events ( title ),
            photographers ( users!photographers_user_id_fkey ( email ) ),
            organizer:users!photographer_bookings_organizer_id_fkey ( name )
          `,
        )
        .eq("id", bookingId)
        .single();
      if (error || !data) return res.status(404).json({ error: "Booking not found" });
      const row = data as any;
      const photographerEmail = Array.isArray(row.photographers?.users)
        ? row.photographers.users[0]?.email
        : row.photographers?.users?.email;
      if (!photographerEmail) return res.json({ status: "ok" });
      const payload = photographerBookingRequestEmail(photographerEmail, {
        eventTitle: row.events?.title ?? "Your event",
        organizerName: row.organizer?.name ?? "An organiser",
        notes: row.notes ?? null,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: "ok" });
    } catch (e: any) {
      console.error("Failed to send photographer booking email", e?.message || e);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // --- Activity request notification helpers ---
  app.post("/api/activity-requests/:id/notify-creator", authenticateSupabase, async (req: any, res) => {
    const requestId = req.params.id as string | undefined;
    if (!requestId) return res.status(400).json({ error: "Invalid request id" });

    try {
      const { data, error } = await supabase
        .from("activity_requests")
        .select(
          `
            id,
            creator:users!activity_requests_creator_id_fkey ( email ),
            activity_type,
            activity_date,
            location_name,
            min_people,
            max_people
          `,
        )
        .eq("id", requestId)
        .single();
      if (error || !data) return res.status(404).json({ error: "Activity request not found" });

      const { data: members } = await supabase
        .from("activity_request_members")
        .select("id")
        .eq("request_id", requestId);

      const row = data as any;
      const email = Array.isArray(row.creator) ? row.creator[0]?.email : row.creator?.email;
      if (!email) return res.json({ status: "ok" });

      const peopleJoined = (members ?? []).length;
      const maxPeople = row.max_people ?? peopleJoined;
      const activityDate = new Date(row.activity_date as string).toLocaleDateString("en-KE", {
        dateStyle: "full",
      });
      const origin = config.appUrl || "https://twende.app";
      const requestUrl = `${origin}/activity/${row.id}`;

      const payload = activityRequestJoinEmail(email, {
        activityType: row.activity_type ?? "Your plan",
        activityDate,
        locationName: row.location_name ?? "Your location",
        peopleJoined,
        maxPeople,
        requestUrl,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: "ok" });
    } catch (e: any) {
      console.error("Failed to send activity request join email", e?.message || e);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/activity-requests/:id/notify-converted", authenticateSupabase, async (req: any, res) => {
    const requestId = req.params.id as string | undefined;
    if (!requestId) return res.status(400).json({ error: "Invalid request id" });

    try {
      const { data, error } = await supabase
        .from("activity_requests")
        .select(
          `
            id,
            creator:users!activity_requests_creator_id_fkey ( email ),
            activity_type,
            activity_date,
            location_name,
            event_id
          `,
        )
        .eq("id", requestId)
        .single();
      if (error || !data) return res.status(404).json({ error: "Activity request not found" });
      const row = data as any;

      if (!row.event_id) return res.status(400).json({ error: "Request has not been converted to an event" });

      const email = Array.isArray(row.creator) ? row.creator[0]?.email : row.creator?.email;
      if (!email) return res.json({ status: "ok" });

      const activityDate = new Date(row.activity_date as string).toLocaleDateString("en-KE", {
        dateStyle: "full",
      });
      const origin = config.appUrl || "https://twende.app";
      const eventUrl = `${origin}/events/${row.event_id}`;

      const payload = activityRequestConvertedEmail(email, {
        activityType: row.activity_type ?? "Your plan",
        activityDate,
        locationName: row.location_name ?? "Your location",
        eventUrl,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: "ok" });
    } catch (e: any) {
      console.error("Failed to send activity request converted email", e?.message || e);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  registerPayoutRoutes({
    app,
    supabase,
    authenticateSupabase,
    getAdminUser,
    getMpesaAccessToken,
    logPayoutTraffic,
  });

  registerAdminRoutes({
    app,
    supabase,
    authenticateSupabase,
    getAdminUser,
    finalizeParticipantBookingPayment,
    applyApprovedPaymentEffects,
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
