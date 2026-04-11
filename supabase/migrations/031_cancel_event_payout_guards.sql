SET search_path TO public;

CREATE OR REPLACE FUNCTION public.cancel_open_payouts_for_cancelled_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> NEW.status THEN
    UPDATE public.payouts
       SET status = 'failed',
           failure_reason = 'Event cancelled before payout execution',
           processed_at = NOW()
     WHERE event_id = NEW.id
       AND status IN ('pending', 'verifying');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_open_payouts_for_cancelled_event ON public.events;
CREATE TRIGGER trg_cancel_open_payouts_for_cancelled_event
AFTER UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.cancel_open_payouts_for_cancelled_event();
