# TwendeHub

Kenya-first outdoor group experiences platform built with React, Express, Supabase, M-Pesa Daraja, Resend email, and Supabase Realtime.

## Local development

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set the required values.
3. Run the app:
   ```bash
   npm run dev
   ```

## Production deployment

### Path A — Vercel (recommended after chat migration)

- **Frontend**: Deploy the Vite app to Vercel.
- **Backend**: Deploy the Express API separately, or adapt `vercel.json` for API routing.
- **Realtime chat**: Enable Supabase Realtime for the `chat_messages` table.
- **Why this works**: chat no longer depends on an in-process WebSocket server.

### Path B — Long-running server (Railway / Render / EC2)

- Use the included `Dockerfile`.
- Build and run with:
  ```bash
  npm install
  npm run build
  npm run dev
  ```
- Configure all environment variables in your hosting platform.

## Required vs optional environment variables

| Variable | Required in production | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes | Backend connection to Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secure server-side Supabase operations |
| `SUPABASE_JWT_SECRET` | Yes | Verify bearer tokens on server routes |
| `VITE_SUPABASE_URL` | Yes | Browser Supabase client |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser Supabase anon key |
| `MPESA_CONSUMER_KEY` | Yes | Daraja auth |
| `MPESA_CONSUMER_SECRET` | Yes | Daraja auth |
| `MPESA_SHORT_CODE` | Yes | Paybill/Till shortcode |
| `MPESA_PASSKEY` | Yes | STK password generation |
| `MPESA_CALLBACK_URL` | Yes | STK callback endpoint |
| `MPESA_WEBHOOK_SECRET` | Yes | Required in production for callback verification |
| `MPESA_B2C_INITIATOR_NAME` | Optional | Needed for automatic organiser payouts |
| `MPESA_B2C_SECURITY_CREDENTIAL` | Optional | Needed for automatic organiser payouts |
| `MPESA_B2C_RESULT_URL` | Optional | B2C success callback |
| `MPESA_B2C_QUEUE_TIMEOUT_URL` | Optional | B2C timeout callback |
| `RESEND_API_KEY` | Yes | Transactional emails |
| `EMAIL_FROM` | Yes | Sender email |
| `EMAIL_FROM_NAME` | Yes | Sender display name |
| `UPSTASH_REDIS_REST_URL` | Recommended | Shared rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Shared rate limiting |
| `APP_URL` | Yes | Canonical app/backend URL |
| `CORS_ORIGINS` | Yes | Allowed frontend origins |

## Supabase configuration notes

- Replace any project-specific examples with your own project values.
- Example project placeholder: `<YOUR_SUPABASE_PROJECT_ID>`
- Enable Realtime on `chat_messages` in the Supabase dashboard.
- Apply every migration in `supabase/migrations/` before going live.

## Operational launch checklist

- Rotate all old secrets before production.
- Verify M-Pesa callbacks are signed and `MPESA_WEBHOOK_SECRET` is set.
- Test organiser event creation payment.
- Test participant paid join flow.
- Test admin manual payment review.
- Test admin payout execution.
- Test chat reporting and moderation.
- Confirm backups, logs, and alerts are enabled.
