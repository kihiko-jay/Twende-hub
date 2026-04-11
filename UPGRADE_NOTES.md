
# TwendeHub Upgrade Notes

## v2 delivered
- Added Safaricom IP allowlist protection for B2C payout callbacks in production.
- Added admin DELETE RLS policy for `reported_messages`, enabling the dismiss action.
- Added `e2e/payments.spec.ts` for event creation, participant join, invalid phone, and unauthenticated redirect flows.
- Added `src/services/payments.ts` and matching unit tests for payload shape, phone validation, and polling termination.
- Made Upstash Redis mandatory in production for API rate limiting.
- Added unique constraint protection for `revenue_summary` upserts.
- Added a trigger to overwrite `chat_messages.user_name` from the `users` table and reject blank content.
- Renamed duplicate migration `019_server_payment_booking_finalization.sql` to `019b_server_payment_booking_finalization.sql` to avoid ambiguous migration ordering.

## Operator reminder
- Apply new migrations before deploying the updated bundle.
- Re-run lint, unit tests, and Playwright tests after installing dependencies in your target environment.
- Rotate production secrets before go-live if any old credentials were previously committed.


## April 11, 2026 production hardening pass
- Extracted payout execution and Safaricom B2C callback handling into `src/server/payoutRoutes.ts` to reduce `server.ts` responsibility.
- Centralized Kenyan phone validation / normalization and Safaricom callback IP allowlist in `src/server/paymentUtils.ts`.
- Expanded Kenyan number support to both `07xxxxxxxx` and `01xxxxxxxx` formats.
- Upgraded `/api/payments/verify` so manual review can safely record `creation`, `feature`, or `participant` payments with raw review metadata.
- Hardened admin manual payment approval/rejection with payment log entries and explicit creation-payment failure handling on rejection.
- Added migration `031_cancel_event_payout_guards.sql` so pending/verifying payouts are automatically failed when an event is cancelled.
- Added server-side unit test coverage for phone normalization and manual-review type parsing in `src/server/__tests__/paymentUtils.test.ts`.
