-- Fix: "column reference \"request_id\" is ambiguous" in join_activity_request.
-- RETURNS TABLE (request_id, ...) creates a name in scope that conflicts with
-- activity_request_members.request_id in ON CONFLICT (request_id, user_id).
-- Use ON CONFLICT ON CONSTRAINT so we don't reference the column name.

CREATE OR REPLACE FUNCTION public.join_activity_request(
  p_request_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,
  event_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_request public.activity_requests%ROWTYPE;
  v_member_count INTEGER;
  v_event_id BIGINT;
  v_already_member BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to join an activity request'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock the request to guard against concurrent joins.
  SELECT *
  INTO v_request
  FROM public.activity_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'open' THEN
    RAISE EXCEPTION 'Activity request % not found or not open', p_request_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- If user is already a member, don't treat this as a new slot.
  SELECT EXISTS (
    SELECT 1
    FROM public.activity_request_members arm
    WHERE arm.request_id = p_request_id
      AND arm.user_id = v_user_id
  )
  INTO v_already_member;

  IF NOT v_already_member THEN
    -- Enforce max_people capacity before inserting.
    SELECT COUNT(*)
    INTO v_member_count
    FROM public.activity_request_members arm
    WHERE arm.request_id = p_request_id;

    IF v_request.max_people IS NOT NULL AND v_member_count >= v_request.max_people THEN
      RAISE EXCEPTION 'Activity request % is already at capacity', p_request_id
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.activity_request_members (request_id, user_id)
    VALUES (p_request_id, v_user_id)
    ON CONFLICT ON CONSTRAINT activity_request_members_request_id_user_id_key DO NOTHING;
  END IF;

  -- Attempt auto-conversion; function will be a no-op if threshold is not yet met.
  v_event_id := public.create_event_from_activity_request(p_request_id);

  RETURN QUERY
  SELECT p_request_id, v_event_id;
END;
$$;
