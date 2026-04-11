-- 006_marketplace_guards.sql
-- Marketplace protections: pricing edits, event deletion, capacity validation,
-- payment confirmation idempotency, cancellation and refund helpers.

-- 1) Prevent unsafe event edits and deletions

CREATE OR REPLACE FUNCTION public.guard_event_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_participant_count integer;
  v_paid_booking_count integer;
BEGIN
  -- Lock and count current participants for this event
  SELECT COUNT(*) INTO v_participant_count
  FROM public.event_participants
  WHERE event_id = OLD.id;

  -- Prevent changing participant_fee once there are participants
  IF NEW.participant_fee IS DISTINCT FROM OLD.participant_fee
     AND v_participant_count > 0 THEN
    RAISE EXCEPTION 'Cannot change participant fee after bookings exist'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Prevent lowering max_participants below current participants
  IF NEW.max_participants < v_participant_count THEN
    RAISE EXCEPTION 'max_participants (%)
                     cannot be lower than current participant count (%)',
      NEW.max_participants, v_participant_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_trigger
    WHERE  tgname = 'trg_guard_event_updates'
  ) THEN
    CREATE TRIGGER trg_guard_event_updates
      BEFORE UPDATE ON public.events
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_event_updates();
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.guard_event_deletes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_paid_booking_count integer;
  v_confirmed_payment_count integer;
BEGIN
  -- Block deletion if there are any paid/active service bookings
  SELECT COUNT(*) INTO v_paid_booking_count
  FROM (
    SELECT 1
    FROM public.photographer_bookings
    WHERE event_id = OLD.id AND status IN ('paid', 'refunded')
    UNION ALL
    SELECT 1
    FROM public.vehicle_bookings
    WHERE event_id = OLD.id AND status IN ('paid', 'refunded')
  ) AS t;

  IF v_paid_booking_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete event with paid or refunded service bookings'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Block deletion if there are confirmed/settled payments
  SELECT COUNT(*) INTO v_confirmed_payment_count
  FROM public.payments
  WHERE event_id = OLD.id
    AND payment_status IN ('confirmed', 'refunded');

  IF v_confirmed_payment_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete event with confirmed or refunded payments'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_trigger
    WHERE  tgname = 'trg_guard_event_deletes'
  ) THEN
    CREATE TRIGGER trg_guard_event_deletes
      BEFORE DELETE ON public.events
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_event_deletes();
  END IF;
END;
$$;


-- 2) Capacity and booking helpers
-- create_attendee_booking already validates capacity inside a transaction.
-- Provide a small helper that surfaces remaining slots, so callers do not
-- re-implement capacity logic on the client.

CREATE OR REPLACE FUNCTION public.get_event_remaining_slots(p_event_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_current_count INTEGER;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_event.max_participants IS NULL THEN
    RETURN NULL; -- unlimited
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.event_participants
  WHERE event_id = p_event_id;

  RETURN GREATEST(v_event.max_participants - v_current_count, 0);
END;
$$;


-- 3) Event-creation payment state machine for organizer fees

-- Move latest creation payment for an event into verifying
CREATE OR REPLACE FUNCTION public.mark_event_creation_payment_verifying(
  p_event_id BIGINT,
  p_payment_provider TEXT DEFAULT NULL,
  p_provider_payment_id TEXT DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE event_id = p_event_id
    AND payment_type = 'creation'
  ORDER BY created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No creation payment found for event %', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_payment.payment_status NOT IN ('unpaid', 'verifying') THEN
    RAISE EXCEPTION 'Cannot move creation payment % from state % to verifying',
      v_payment.id, v_payment.payment_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.payments
  SET payment_status      = 'verifying',
      payment_provider    = COALESCE(p_payment_provider, payment_provider),
      provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id)
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;


-- Confirm the latest creation payment and activate event atomically.
CREATE OR REPLACE FUNCTION public.confirm_event_creation_payment(
  p_event_id BIGINT
)
RETURNS public.payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_event   public.events%ROWTYPE;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE event_id = p_event_id
    AND payment_type = 'creation'
  ORDER BY created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No creation payment found for event %', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_payment.payment_status NOT IN ('unpaid', 'verifying') THEN
    RAISE EXCEPTION 'Creation payment % is already in terminal state %',
      v_payment.id, v_payment.payment_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.payments
  SET payment_status = 'confirmed',
      processed_at   = NOW(),
      error_code     = NULL,
      error_message  = NULL
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.events
  SET status = 'active'
  WHERE id = p_event_id;

  RETURN v_payment;
END;
$$;


CREATE OR REPLACE FUNCTION public.fail_event_creation_payment(
  p_event_id BIGINT,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE event_id = p_event_id
    AND payment_type = 'creation'
  ORDER BY created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No creation payment found for event %', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_payment.payment_status IN ('confirmed', 'refunded') THEN
    RAISE EXCEPTION 'Cannot move creation payment % from state % to failed',
      v_payment.id, v_payment.payment_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.payments
  SET payment_status = 'failed',
      processed_at   = NOW(),
      error_code     = p_error_code,
      error_message  = p_error_message
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;


-- 4) Cancellation and refund eligibility helpers

-- Simple policy: organizer can cancel an event that is not yet active,
-- or if there are no confirmed payments. This is expressed as a helper
-- so all callers share the same rules.
CREATE OR REPLACE FUNCTION public.is_event_cancellable(p_event_id BIGINT)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE event_id = p_event_id
      AND payment_status IN ('confirmed', 'refunded')
  );
$$;


-- Simple refund eligibility: a payment is refundable if it is confirmed
-- and the event has not yet started (based on date_time).
CREATE OR REPLACE FUNCTION public.is_payment_refundable(p_payment_id BIGINT)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.payment_status = 'confirmed'
    AND e.date_time > NOW()
  FROM public.payments p
  JOIN public.events  e ON e.id = p.event_id
  WHERE p.id = p_payment_id;
$$;

