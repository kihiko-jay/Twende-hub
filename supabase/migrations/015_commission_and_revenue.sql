-- 015_commission_and_revenue.sql
-- Commission-based monetization and revenue summary aggregation.

SET search_path TO public;

-- 1) Per-organizer commission percentage

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.0;


-- 2) Commission and net amounts on payments

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2) NOT NULL DEFAULT 0;


-- 3) Revenue summary table (per organizer / event / month)

CREATE TABLE IF NOT EXISTS public.revenue_summary (
  id BIGSERIAL PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_revenue_summary_organizer_period
  ON public.revenue_summary (organizer_id, period_start);

CREATE INDEX IF NOT EXISTS idx_revenue_summary_event
  ON public.revenue_summary (event_id);


-- 4) Helper to update commission amounts and aggregate into revenue_summary

CREATE OR REPLACE FUNCTION public.apply_commission_and_update_revenue(p_payment_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_event   public.events%ROWTYPE;
  v_organizer public.users%ROWTYPE;
  v_commission_pct NUMERIC(5,2);
  v_commission NUMERIC(12,2);
  v_net NUMERIC(12,2);
  v_period_start DATE;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only aggregate confirmed organizer-facing payments (creation / feature).
  IF v_payment.payment_status NOT IN ('confirmed', 'success') THEN
    RETURN;
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_payment.event_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_organizer FROM public.users WHERE id = v_event.organizer_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_commission_pct := COALESCE(v_organizer.commission_percentage, 5.0);
  v_commission := ROUND((v_payment.amount::NUMERIC * v_commission_pct) / 100.0, 2);
  v_net := GREATEST(v_payment.amount::NUMERIC - v_commission, 0);

  UPDATE public.payments
  SET commission_amount = v_commission,
      net_amount        = v_net
  WHERE id = v_payment.id;

  v_period_start := date_trunc('month', NOW())::DATE;

  INSERT INTO public.revenue_summary (
    organizer_id,
    event_id,
    period_start,
    gross_amount,
    commission_amount,
    net_amount
  )
  VALUES (
    v_event.organizer_id,
    v_event.id,
    v_period_start,
    v_payment.amount,
    v_commission,
    v_net
  )
  ON CONFLICT (organizer_id, event_id, period_start)
  DO UPDATE
  SET gross_amount = public.revenue_summary.gross_amount + EXCLUDED.gross_amount,
      commission_amount = public.revenue_summary.commission_amount + EXCLUDED.commission_amount,
      net_amount = public.revenue_summary.net_amount + EXCLUDED.net_amount;
END;
$$;


-- 5) Trigger: when a payment transitions into confirmed, apply commission and update summary.

CREATE OR REPLACE FUNCTION public.trg_payments_commission_revenue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status IN ('confirmed', 'success')
     AND COALESCE(OLD.payment_status, '') <> NEW.payment_status THEN
    PERFORM public.apply_commission_and_update_revenue(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_trigger
    WHERE  tgname = 'trg_payments_commission_revenue'
  ) THEN
    CREATE TRIGGER trg_payments_commission_revenue
      AFTER UPDATE OF payment_status ON public.payments
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_payments_commission_revenue();
  END IF;
END;
$$;

