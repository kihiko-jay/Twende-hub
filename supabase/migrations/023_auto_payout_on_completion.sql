SET search_path TO public;

DO $$
BEGIN
  ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'completed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.create_organiser_payout_on_event_complete(p_event_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_amount NUMERIC;
BEGIN
  SELECT id, organizer_id INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(COALESCE(net_amount, amount)), 0)
    INTO v_amount
  FROM public.payments
  WHERE event_id = p_event_id
    AND payment_type = 'participant'
    AND payment_status IN ('confirmed', 'success');

  IF v_amount <= 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payouts
    WHERE event_id = p_event_id AND status IN ('pending', 'verifying', 'confirmed')
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.payouts (recipient_user_id, amount, currency, status, event_id)
  VALUES (v_event.organizer_id, v_amount, 'KES', 'pending', p_event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_completion_payout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> NEW.status THEN
    PERFORM public.create_organiser_payout_on_event_complete(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_completion_payout ON public.events;
CREATE TRIGGER trg_event_completion_payout
AFTER UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_completion_payout();
