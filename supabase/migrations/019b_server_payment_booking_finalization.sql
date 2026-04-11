-- 019_server_payment_booking_finalization.sql
-- Server-side helper for M-Pesa callback processing so paid attendee bookings
-- are finalized through one consistent DB transition path.

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.finalize_attendee_payment_by_server(
  p_event_id BIGINT,
  p_user_id UUID,
  p_payment_id BIGINT
)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.event_participants%ROWTYPE;
BEGIN
  SELECT *
  INTO v_participant
  FROM public.event_participants
  WHERE event_id = p_event_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.event_participants (event_id, user_id, booking_status, payment_status, payment_id)
    VALUES (p_event_id, p_user_id, 'draft', 'unpaid', p_payment_id)
    RETURNING * INTO v_participant;
  END IF;

  -- Idempotent success path.
  IF v_participant.booking_status = 'confirmed'
     AND v_participant.payment_status = 'confirmed'
     AND (v_participant.payment_id = p_payment_id OR v_participant.payment_id IS NULL) THEN
    UPDATE public.event_participants
    SET payment_id = COALESCE(payment_id, p_payment_id)
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;
    RETURN v_participant;
  END IF;

  IF v_participant.booking_status IN ('cancelled', 'refunded', 'completed') THEN
    RAISE EXCEPTION 'Booking % cannot be finalized from terminal state %', v_participant.id, v_participant.booking_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.guard_event_capacity(v_participant.event_id);

  UPDATE public.event_participants
  SET booking_status = 'confirmed',
      payment_status = 'confirmed',
      payment_id = p_payment_id
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  UPDATE public.payments
  SET booking_id = v_participant.id
  WHERE id = p_payment_id
    AND (booking_id IS NULL OR booking_id = v_participant.id);

  RETURN v_participant;
END;
$$;
