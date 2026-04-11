-- 018_activity_requests.sql
-- Instant Group Adventure (Find People) data model and helpers.

-- Table: public.activity_requests
-- Represents a lightweight intent to do an activity at a given time and place,
-- which can later be converted into a full Twende event.

CREATE TABLE public.activity_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id),
  activity_type TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  activity_date DATE NOT NULL,
  activity_time TIME WITHOUT TIME ZONE NULL,
  status TEXT NOT NULL DEFAULT 'open',
  min_people INTEGER NOT NULL DEFAULT 4,
  max_people INTEGER NOT NULL DEFAULT 10,
  event_id BIGINT NULL REFERENCES public.events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including unauthenticated visitors) to view open requests.
CREATE POLICY "Anyone can view open activity requests"
  ON public.activity_requests
  FOR SELECT
  USING (status = 'open');

-- Only authenticated users can create requests for themselves.
CREATE POLICY "Authenticated can create activity requests"
  ON public.activity_requests
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Creators can update their own requests (e.g., cancel).
CREATE POLICY "Creators can update own activity requests"
  ON public.activity_requests
  FOR UPDATE
  USING (auth.uid() = creator_id);


-- Table: public.activity_request_members
-- Tracks which users have joined a given activity request.

CREATE TABLE public.activity_request_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.activity_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.activity_request_members ENABLE ROW LEVEL SECURITY;

-- Members and creators can see who has joined.
CREATE POLICY "Members and creators can view activity request members"
  ON public.activity_request_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.activity_requests ar
      WHERE ar.id = request_id
        AND ar.creator_id = auth.uid()
    )
  );

-- Authenticated users can join requests as themselves.
CREATE POLICY "Authenticated can join activity requests"
  ON public.activity_request_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- Indexes for common discovery queries.

CREATE INDEX idx_activity_requests_type ON public.activity_requests (activity_type);
CREATE INDEX idx_activity_requests_date ON public.activity_requests (activity_date);
CREATE INDEX idx_activity_requests_status ON public.activity_requests (status);
CREATE INDEX idx_activity_requests_location_name ON public.activity_requests (location_name);
CREATE INDEX idx_activity_requests_status_type_date
  ON public.activity_requests (status, activity_type, activity_date);

CREATE INDEX idx_activity_request_members_request_id
  ON public.activity_request_members (request_id);


-- Helper: create a Twende event from an activity request once the group is big enough.

CREATE OR REPLACE FUNCTION public.create_event_from_activity_request(p_request_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.activity_requests%ROWTYPE;
  v_member_count INTEGER;
  v_event_id BIGINT;
  v_date_time TIMESTAMPTZ;
BEGIN
  -- Lock the request row to prevent race conditions.
  SELECT *
  INTO v_request
  FROM public.activity_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity request % not found', p_request_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- If already converted or not open, just return existing event_id (which may be NULL).
  IF v_request.status <> 'open' THEN
    RETURN v_request.event_id;
  END IF;

  SELECT COUNT(*)
  INTO v_member_count
  FROM public.activity_request_members arm
  WHERE arm.request_id = p_request_id;

  IF v_member_count < v_request.min_people THEN
    -- Not enough people yet; no event created.
    RETURN NULL;
  END IF;

  -- If an event is already linked, don't create a duplicate.
  IF v_request.event_id IS NOT NULL THEN
    RETURN v_request.event_id;
  END IF;

  -- Build a reasonable event date_time from date + optional time.
  v_date_time :=
    (v_request.activity_date::timestamptz)
    + COALESCE(v_request.activity_time::interval, INTERVAL '09:00:00');

  -- Create the Twende event as a normal free, public group event.
  INSERT INTO public.events (
    organizer_id,
    title,
    description,
    category,
    type,
    location,
    latitude,
    longitude,
    date_time,
    max_participants,
    participant_fee,
    visibility,
    status,
    is_featured,
    featured_until,
    cover_image,
    duration
  )
  VALUES (
    v_request.creator_id,
    v_request.activity_type || ' Meetup',
    'Created automatically from Twende activity matching',
    v_request.activity_type,
    'Group',
    v_request.location_name,
    v_request.latitude,
    v_request.longitude,
    v_date_time,
    v_request.max_people,
    0,
    'public',
    'active',
    FALSE,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_event_id;

  -- Add all members as confirmed participants in the new event.
  INSERT INTO public.event_participants (
    event_id,
    user_id,
    booking_status,
    payment_status,
    commission_amount
  )
  SELECT
    v_event_id,
    arm.user_id,
    'confirmed',
    'confirmed',
    0
  FROM public.activity_request_members arm
  WHERE arm.request_id = p_request_id
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Mark the request as converted and link the event.
  UPDATE public.activity_requests
  SET status = 'converted_to_event',
      event_id = v_event_id
  WHERE id = p_request_id;

  RETURN v_event_id;
END;
$$;


-- RPC: join an activity request and, if threshold is met, auto-convert to an event.

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
    ON CONFLICT (request_id, user_id) DO NOTHING;
  END IF;

  -- Attempt auto-conversion; function will be a no-op if threshold is not yet met.
  v_event_id := public.create_event_from_activity_request(p_request_id);

  RETURN QUERY
  SELECT p_request_id, v_event_id;
END;
$$;

