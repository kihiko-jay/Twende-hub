import "dotenv/config";
import express, { type Request, type Response } from "express";
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
import { log } from "./src/lib/logger.js";
import {
  sendEmail,
  paymentReceiptEmail,
  bookingConfirmationEmail,
} from "./src/lib/email.js";
import { applyApprovedPaymentEffects, extractMpesaReceipt, normalizePaymentStatus } from "./src/server/paymentService.js";
import { registerAdminRoutes } from "./src/server/adminRoutes.js";
import { getManualReviewType, isValidKenyanPhone, normalizeKenyanPhone } from "./src/server/paymentUtils.js";
import { registerPayoutRoutes } from "./src/server/payoutRoutes.js";
import { registerNotificationRoutes } from "./src/server/notificationRoutes.js";
import type { AuthedRequest } from "./src/server/types.js";

const supabase = supabaseServer;


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
  const data = await res.json() as Record<string, unknown>;
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
  payload: unknown;
  error?: string | null;
}) {
  await supabase.from('payout_logs').insert({
    payout_id: payload.payout_id ?? null,
    direction: payload.direction,
    endpoint: payload.endpoint,
    status_code: payload.status_code,
    payload: payload.payload as Record<string, unknown>,
    error: payload.error ?? null,
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Trust one reverse-proxy hop so req.ip reflects the real client IP
  // and X-Forwarded-For is only read from a verified upstream.
  app.set('trust proxy', 1);

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

  // --- Security headers ---
  app.use((req: Request, res: Response, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0");

    if (!config.isProd) return next();

    // In production the Vite build produces external .js files only (no inline
    // scripts), so 'self' is sufficient — no nonce or unsafe-inline needed.
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://images.unsplash.com https://picsum.photos https://ofymavvwnqldipzetivb.supabase.co",
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

  // Evict expired entries from the in-memory fallback store every window.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt < now) rateLimitStore.delete(key);
    }
  }, RATE_WINDOW_MS);

  let ratelimit: Ratelimit | null = null;
  if (config.redisEnabled) {
    const redis = new Redis({ url: config.upstashRedisUrl, token: config.upstashRedisToken });
    ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '60 s') });
  }

  app.use('/api', async (req: Request, res: Response, next) => {
    // req.ip is trusted because we set 'trust proxy' 1 above.
    const ip = req.ip || 'unknown';
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

  // --- Supabase JWT auth middleware ---
  const authenticateSupabase = async (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);
    if (!config.supabaseJwtSecret) {
      log({ level: 'error', message: 'SUPABASE_JWT_SECRET is required for authenticated routes' });
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
      (req as AuthedRequest).user = profile as AuthedRequest['user'];
      next();
    } catch {
      return res.sendStatus(403);
    }
  };

  // Request logging
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on("finish", () => {
      log({ level: 'info', message: `${req.method} ${req.originalUrl} ${res.statusCode}`, context: { ms: Date.now() - start } });
    });
    next();
  });

  // Health check
  app.get("/health", async (_req: Request, res: Response) => {
    try {
      if (config.supabaseUrl && config.supabaseServiceRoleKey) {
        await supabase.from("events").select("id").limit(1).maybeSingle();
      }
      res.json({ status: "ok", env: config.nodeEnv });
    } catch {
      res.status(500).json({ status: "error", env: config.nodeEnv });
    }
  });

  // --- Payment routes ---
  app.post("/api/payments/initiate", authenticateSupabase, async (req: Request, res: Response) => {
    const authedReq = req as AuthedRequest;
    const { event_id, type = "creation" as const, phone, phone_number } = req.body as {
      event_id: number;
      type?: import("./src/lib/supabase.types.js").PaymentType;
      phone?: string;
      phone_number?: string;
    };

    // For participant payments, validate the amount against the event's stored fee.
    if (type === "participant") {
      const { data: eventWithFee } = await supabase
        .from("events")
        .select("id, status, participant_fee")
        .eq("id", event_id)
        .eq("status", "active")
        .single();
      if (!eventWithFee) return res.status(404).json({ error: "Event not found or not active" });

      const requestedAmount = Number(req.body.amount ?? 0);
      const expectedFee = (eventWithFee as { id: number; status: string; participant_fee: number | null }).participant_fee ?? 0;

      if (requestedAmount <= 0 || Number.isNaN(requestedAmount)) {
        return res.status(400).json({ error: "Invalid participant fee amount" });
      }
      if (requestedAmount !== expectedFee) {
        return res.status(400).json({ error: "Payment amount does not match event fee" });
      }
    }

    const amount =
      type === "feature"
        ? 500
        : type === "creation"
        ? 1000
        : type === "participant"
        ? Number(req.body.amount ?? 0)
        : 1000;

    // Fetch event for authorization (non-participant types must be owned by the requester).
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
            .eq("organizer_id", authedReq.user.id)
            .single();
    if (eventErr || !event) return res.status(404).json({ error: "Event not found or unauthorized" });

    const msisdn = phone_number || phone || authedReq.user.phone;
    if (!msisdn) return res.status(400).json({ error: "Phone number is required for M-Pesa payment" });
    if (!isValidKenyanPhone(msisdn)) {
      return res.status(400).json({ error: "Provide a valid Kenyan Safaricom phone number" });
    }

    // Development / sandbox: simulate an asynchronous approval.
    if (!config.isProd || !config.mpesaEnabled) {
      const checkoutId = `MOCK-${event_id}-${Date.now()}`;
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          user_id: authedReq.user.id,
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

      setTimeout(async () => {
        try {
          await supabase
            .from("payments")
            .update({ payment_status: "confirmed", processed_at: new Date().toISOString() })
            .eq("id", payment.id);
          await applyApprovedPaymentEffects(supabase as Parameters<typeof applyApprovedPaymentEffects>[0], payment, finalizeParticipantBookingPayment);
        } catch (err) {
          log({ level: 'error', message: 'Error auto-confirming mock payment', error: err });
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
        user_id: authedReq.user.id,
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
      const stkData = await stkRes.json() as Record<string, unknown>;

      await supabase.from("payment_logs").insert({
        direction: "outgoing",
        endpoint: "/mpesa/stkpush/v1/processrequest",
        status_code: stkRes.status,
        payload: stkBody as unknown as Record<string, unknown>,
        headers: null,
        error: !stkRes.ok ? JSON.stringify(stkData) : null,
        payment_id: payment.id,
      });

      if (!stkRes.ok || stkData.ResponseCode !== "0") {
        log({ level: 'error', message: 'M-Pesa STK error', context: stkData as Record<string, unknown> });
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
    } catch (err) {
      log({ level: 'error', message: 'Error initiating M-Pesa payment', error: err });
      res.status(502).json({ error: "Failed to initiate M-Pesa payment" });
    }
  });

  app.post("/api/payments/mpesa-callback", async (req: Request, res: Response) => {
    try {
      const rawBody = req.body as Record<string, unknown>;
      const callback = (rawBody?.Body as Record<string, unknown>)?.stkCallback as Record<string, unknown> | undefined;
      if (!callback) return res.status(400).json({ error: "Invalid callback payload" });

      if (config.isProd && !config.mpesaWebhookSecret) {
        return res.status(503).json({ error: 'Webhook verification not configured' });
      }

      if (config.mpesaWebhookSecret) {
        const signature = (req.headers["x-mpesa-signature"] as string) || "";
        const expected = crypto
          .createHmac("sha256", config.mpesaWebhookSecret)
          .update(JSON.stringify(rawBody))
          .digest("hex");
        if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          log({ level: 'error', message: 'M-Pesa callback signature verification failed' });
          return res.status(400).json({ error: "Invalid signature" });
        }
      }

      const checkoutId = callback.CheckoutRequestID as string;
      const resultCode = callback.ResultCode as number;
      const resultDesc = callback.ResultDesc as string;

      // Atomically claim the payment by updating only if still pending.
      // This prevents duplicate callbacks from both applying payment effects.
      const { data: updatedRows } = await supabase
        .from("payments")
        .update({
          payment_status: resultCode === 0 ? "confirmed" : "failed",
          processed_at: new Date().toISOString(),
          raw_payload: rawBody,
          ...(resultCode !== 0 && {
            error_code: String(resultCode),
            error_message: resultDesc,
          }),
        })
        .eq("transaction_reference", checkoutId)
        .eq("payment_status", "pending")
        .select("id, event_id, user_id, amount, payment_type, provider_payment_id");

      await supabase.from("payment_logs").insert({
        direction: "incoming",
        endpoint: "/api/payments/mpesa-callback",
        status_code: 200,
        payload: rawBody,
        headers: req.headers as unknown as Record<string, unknown>,
        error: null,
        payment_id: (updatedRows?.[0] as { id: number } | undefined)?.id ?? null,
      });

      if (!updatedRows || updatedRows.length === 0) {
        // Either not found or already in a terminal state — safe to ACK.
        return res.json({ ResultCode: 0, ResultDesc: "Already processed" });
      }

      const pay = updatedRows[0] as {
        id: number;
        event_id: number;
        user_id: string;
        amount: number;
        payment_type: string;
        provider_payment_id: string | null;
      };

      if (resultCode === 0) {
        const mpesaReceipt = extractMpesaReceipt(rawBody);

        if (mpesaReceipt) {
          await supabase
            .from("payments")
            .update({ provider_payment_id: mpesaReceipt })
            .eq("id", pay.id);
        }

        await applyApprovedPaymentEffects(supabase as Parameters<typeof applyApprovedPaymentEffects>[0], pay, finalizeParticipantBookingPayment);

        if (pay.payment_type === "participant") {
          (async () => {
            try {
              const { data: userRow } = await supabase.from("users").select("email").eq("id", pay.user_id).single();
              const { data: eventRow } = await supabase.from("events").select("title, date_time, location").eq("id", pay.event_id).single();
              const email = (userRow as { email: string } | null)?.email;
              const ev = eventRow as { title: string; date_time: string; location: string } | null;
              if (email && ev) {
                const payload = bookingConfirmationEmail(email, {
                  eventTitle: ev.title,
                  eventDate: new Date(ev.date_time).toLocaleString("en-KE", { dateStyle: "full", timeStyle: "short" }),
                  eventLocation: ev.location,
                  bookingType: "Event Participation",
                });
                await sendEmail(payload.to, payload.subject, payload.html);
              }
            } catch (err) {
              log({ level: 'error', message: 'Failed to send booking confirmation email', error: err });
            }
          })();
        }

        (async () => {
          try {
            const { data: userRow } = await supabase.from("users").select("email").eq("id", pay.user_id).single();
            const { data: eventRow } = await supabase.from("events").select("title").eq("id", pay.event_id).single();
            const email = (userRow as { email: string } | null)?.email;
            const title = (eventRow as { title: string } | null)?.title;
            if (email && title) {
              const mpesaReceipt = extractMpesaReceipt(rawBody);
              const payload = paymentReceiptEmail(email, {
                eventTitle: title,
                amount: pay.amount,
                mpesaReceipt: mpesaReceipt ?? pay.provider_payment_id ?? "",
                type: pay.payment_type,
              });
              await sendEmail(payload.to, payload.subject, payload.html);
            }
          } catch (err) {
            log({ level: 'error', message: 'Failed to send payment receipt email', error: err });
          }
        })();
      } else {
        if (pay.payment_type === "creation") {
          await supabase.rpc("fail_event_creation_payment", {
            p_event_id: pay.event_id,
            p_error_code: String(resultCode),
            p_error_message: resultDesc,
          });
        }
      }

      res.json({ ResultCode: 0, ResultDesc: "Success" });
    } catch (err) {
      log({ level: 'error', message: 'Error handling M-Pesa callback', error: err });
      res.json({ ResultCode: 0, ResultDesc: "Received" });
    }
  });

  app.get("/api/payments/status/:checkout_request_id", authenticateSupabase, async (req: Request, res: Response) => {
    const authedReq = req as AuthedRequest;
    const checkoutId = req.params.checkout_request_id;
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

    if (row.user_id !== authedReq.user.id && authedReq.user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }

    const status = normalizePaymentStatus(row.payment_status);

    res.json({
      status,
      type: row.payment_type,
      event_id: row.event_id,
      booking_id: null,
      mpesa_receipt_number: row.provider_payment_id,
    });
  });

  app.get("/api/payments/status", authenticateSupabase, async (req: Request, res: Response) => {
    const authedReq = req as AuthedRequest;
    const eventId = parseInt(req.query.event_id as string, 10);
    if (!eventId) return res.status(400).json({ error: "event_id is required" });
    const { data: event } = await supabase
      .from("events")
      .select("status")
      .eq("id", eventId)
      .eq("organizer_id", authedReq.user.id)
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

  app.post("/api/payments/verify", authenticateSupabase, async (req: Request, res: Response) => {
    const authedReq = req as AuthedRequest;
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
      : await eventQuery.eq("organizer_id", authedReq.user.id).single();

    if (!event) return res.status(404).json({ error: "Event not found or unauthorized" });
    if (paymentType === "participant" && Number(amount) <= 0) {
      return res.status(400).json({ error: "Participant payment amount must be greater than zero" });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: authedReq.user.id,
        event_id: Number(event_id),
        amount: Number(amount),
        transaction_reference: transaction_code as string,
        payment_status: "manual_review_required",
        payment_type: paymentType,
        provider_payment_id: transaction_code as string,
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
      payload: { event_id, transaction_code, amount, phone_number, payment_type: paymentType, review_status: "manual_review_required" } as Record<string, unknown>,
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
  app.get("/api/events/:id/can-cancel", authenticateSupabase, async (req: Request, res: Response) => {
    const authedReq = req as AuthedRequest;
    const eventId = parseInt(req.params.id, 10);
    if (!eventId) return res.status(400).json({ error: "Invalid event id" });

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, organizer_id")
      .eq("id", eventId)
      .single();
    if (eventErr || !event) return res.status(404).json({ error: "Event not found" });

    const isOwner = (event as { organizer_id: string }).organizer_id === authedReq.user.id;
    const isAdmin = authedReq.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Not allowed" });

    const { data, error } = await supabase.rpc("is_event_cancellable", { p_event_id: eventId });
    if (error) return res.status(500).json({ error: "Failed to evaluate" });
    res.json({ can_cancel: Boolean(data) });
  });

  app.get("/api/payments/:id/can-refund", authenticateSupabase, async (req: Request, res: Response) => {
    const authedReq = req as AuthedRequest;
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) return res.status(400).json({ error: "Invalid payment id" });

    if (authedReq.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can check refund eligibility" });
    }

    const { data, error } = await supabase.rpc("is_payment_refundable", { p_payment_id: paymentId });
    if (error) return res.status(500).json({ error: "Failed to evaluate" });
    res.json({ can_refund: Boolean(data) });
  });

  registerNotificationRoutes({ app, supabase: supabase as unknown as Parameters<typeof registerNotificationRoutes>[0]['supabase'], authenticateSupabase });

  registerPayoutRoutes({
    app,
    supabase: supabase as Parameters<typeof registerPayoutRoutes>[0]['supabase'],
    authenticateSupabase,
    getAdminUser,
    getMpesaAccessToken,
    logPayoutTraffic,
  });

  registerAdminRoutes({
    app,
    supabase: supabase as Parameters<typeof registerAdminRoutes>[0]['supabase'],
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
    app.get("*", (_req: Request, res: Response) => res.sendFile(path.resolve("dist/index.html")));
  }

  // On startup in dev, confirm any mock payments that were pending before a restart.
  if (!config.isProd) {
    const cutoff = new Date(Date.now() - 5_000).toISOString();
    const { data: stuckPayments } = await supabase
      .from("payments")
      .select("id, event_id, user_id, payment_type")
      .eq("payment_status", "pending")
      .like("transaction_reference", "MOCK-%")
      .lt("created_at", cutoff);
    for (const p of stuckPayments ?? []) {
      try {
        await supabase
          .from("payments")
          .update({ payment_status: "confirmed", processed_at: new Date().toISOString() })
          .eq("id", p.id);
        await applyApprovedPaymentEffects(supabase as Parameters<typeof applyApprovedPaymentEffects>[0], p as { id: number; event_id: number; user_id: string; payment_type: string }, finalizeParticipantBookingPayment);
      } catch (err) {
        log({ level: 'error', message: `Failed to recover stuck mock payment ${p.id}`, error: err });
      }
    }
  }

  server.listen(config.port, "0.0.0.0", () => {
    log({ level: 'info', message: `Server running on http://localhost:${config.port}` });
  });

  const shutdown = () => {
    server.close(() => {
      log({ level: 'info', message: 'Server closed' });
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  log({ level: 'error', message: 'Failed to start server', error: err });
  process.exit(1);
});
