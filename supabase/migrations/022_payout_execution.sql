SET search_path TO public;

ALTER TABLE IF EXISTS public.payouts
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS initiator_message_id TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_id BIGINT;

CREATE TABLE IF NOT EXISTS public.payout_logs (
  id BIGSERIAL PRIMARY KEY,
  payout_id BIGINT REFERENCES public.payouts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read payout logs"
  ON public.payout_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert payout logs"
  ON public.payout_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
