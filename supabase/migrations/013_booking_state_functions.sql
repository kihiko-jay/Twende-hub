-- 013_booking_state_functions.sql
-- Booking state machine, capacity guards, and helper RPCs for attendee bookings.

-- Helper: count confirmed bookings for an event.

CREATE OR REPLACE FUNCTION public.get_confirmed_booking_count(p_event_id BIGINT)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM public.event_participants ep
  WHERE ep.event_id = p_event_id
    AND ep.booking_status = 'confirmed';
$$;


-- Helper: enforce capacity and event status invariants.

CREATE OR REPLACE FUNCTION public.guard_event_capacity(p_event_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_confirmed_count INTEGER;
BEGIN
  SELECT *
  INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Only active events can accept confirmed bookings.
  IF v_event.status <> 'active' THEN
    RAISE EXCEPTION 'Event % is not open for bookings (status=%)', p_event_id, v_event.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_event.max_participants IS NULL THEN
    RETURN; -- unlimited capacity
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.event_participants ep
  WHERE ep.event_id = p_event_id
    AND ep.booking_status = 'confirmed';

  IF v_confirmed_count >= v_event.max_participants THEN
    RAISE EXCEPTION 'Event % is already at capacity', p_event_id
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;


-- Replace get_event_remaining_slots to use confirmed bookings only.

CREATE OR REPLACE FUNCTION public.get_event_remaining_slots(p_event_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_confirmed_count INTEGER;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_event.max_participants IS NULL THEN
    RETURN NULL; -- unlimited
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.event_participants
  WHERE event_id = p_event_id
    AND booking_status = 'confirmed';

  RETURN GREATEST(v_event.max_participants - v_confirmed_count, 0);
END;
$$;


-- Booking lifecycle RPCs for attendee bookings.
-- These run as SECURITY DEFINER but still use auth.uid() to bind
-- behaviour to the current authenticated user, and enforce their own
-- permission checks rather than relying on broad UPDATE policies.

CREATE OR REPLACE FUNCTION public.create_attendee_booking_v2(p_event_id BIGINT)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_participant public.event_participants%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to book'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Either find existing participant row or create a new draft booking.
  SELECT *
  INTO v_participant
  FROM public.event_participants
  WHERE event_id = p_event_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.event_participants (event_id, user_id, booking_status, payment_status)
    VALUES (p_event_id, v_user_id, 'draft', 'unpaid')
    RETURNING * INTO v_participant;
  END IF;

  RETURN v_participant;
END;
$$;


CREATE OR REPLACE FUNCTION public.transition_booking_to_pending_payment(p_participant_id BIGINT)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_participant public.event_participants%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to update booking'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.event_participants
  WHERE id = p_participant_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found for current user', p_participant_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_participant.booking_status NOT IN ('draft', 'cancelled')
     OR v_participant.payment_status NOT IN ('unpaid', 'failed') THEN
    RAISE EXCEPTION 'Booking % cannot move to pending_payment from (% , %)',
      p_participant_id, v_participant.booking_status, v_participant.payment_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.event_participants
  SET booking_status = 'pending_payment',
      payment_status = 'pending'
  WHERE id = p_participant_id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;


CREATE OR REPLACE FUNCTION public.transition_booking_to_confirmed(
  p_participant_id BIGINT,
  p_payment_id BIGINT DEFAULT NULL
)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_participant public.event_participants%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to confirm booking'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.event_participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_participant_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Only the booking owner or the event organizer can confirm.
  IF v_participant.user_id <> v_user_id AND NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = v_participant.event_id
      AND e.organizer_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not allowed to confirm this booking'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_participant.booking_status NOT IN ('draft', 'pending_payment')
     OR v_participant.payment_status NOT IN ('unpaid', 'pending') THEN
    RAISE EXCEPTION 'Booking % cannot move to confirmed from (% , %)',
      p_participant_id, v_participant.booking_status, v_participant.payment_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Enforce event capacity and open status.
  PERFORM public.guard_event_capacity(v_participant.event_id);

  -- Prevent duplicate confirmed bookings for the same user + event.
  IF EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = v_participant.event_id
      AND ep.user_id = v_participant.user_id
      AND ep.id <> v_participant.id
      AND ep.booking_status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'User already has a confirmed booking for this event'
      USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE public.event_participants
  SET booking_status   = 'confirmed',
      payment_status   = 'confirmed',
      payment_id       = COALESCE(p_payment_id, payment_id)
  WHERE id = p_participant_id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;


CREATE OR REPLACE FUNCTION public.transition_booking_to_cancelled(p_participant_id BIGINT)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_participant public.event_participants%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to cancel booking'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.event_participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_participant_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Booking owner, organiser, or admin (via is_admin()) can cancel.
  IF v_participant.user_id <> v_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.events e
       WHERE e.id = v_participant.event_id
         AND e.organizer_id = v_user_id
     )
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed to cancel this booking'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.event_participants
  SET booking_status = 'cancelled'
  WHERE id = p_participant_id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;


CREATE OR REPLACE FUNCTION public.transition_booking_to_refunded(p_participant_id BIGINT)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.event_participants%ROWTYPE;
BEGIN
  -- Only admins or organiser (through a trusted context) should call this
  -- function; rely on RLS + service role from server or edge functions.

  SELECT *
  INTO v_participant
  FROM public.event_participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_participant_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.event_participants
  SET booking_status = 'refunded',
      payment_status = 'refunded'
  WHERE id = p_participant_id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;


CREATE OR REPLACE FUNCTION public.transition_booking_to_completed(p_participant_id BIGINT)
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
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_participant_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_participant.booking_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings can be completed (booking %, status %)',
      p_participant_id, v_participant.booking_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.event_participants
  SET booking_status = 'completed'
  WHERE id = p_participant_id
  RETURNING * INTO v_participant;

  RETURN v_participant;
END;
$$;


-- Auto-close helper: callers can use this after confirming bookings
-- to automatically close registration when capacity is reached.

CREATE OR REPLACE FUNCTION public.close_event_if_full(p_event_id BIGINT)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_remaining := public.get_event_remaining_slots(p_event_id);

  IF v_remaining IS NOT NULL AND v_remaining <= 0 THEN
    UPDATE public.events
    SET visibility = 'private'
    WHERE id = p_event_id
    RETURNING * INTO v_event;
  END IF;

  RETURN v_event;
END;
$$;

