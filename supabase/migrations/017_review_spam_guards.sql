-- Ensure unique reviews per (event_id, user_id) and tighten RLS

DO $$
DECLARE
  event_attnum SMALLINT;
  user_attnum SMALLINT;
BEGIN
  -- Look up attribute numbers for event_id and user_id on public.reviews
  SELECT attnum INTO event_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.reviews'::regclass
    AND attname = 'event_id'
    AND NOT attisdropped;

  SELECT attnum INTO user_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.reviews'::regclass
    AND attname = 'user_id'
    AND NOT attisdropped;

  -- Add an explicit named unique constraint if one does not already exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[event_attnum, user_attnum]
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_event_user_unique UNIQUE (event_id, user_id);
  END IF;
END
$$;

-- Harden RLS so only participants can insert reviews for events they joined

DROP POLICY IF EXISTS "Authenticated can insert own review" ON public.reviews;

CREATE POLICY "Participants can review attended events"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = reviews.event_id
        AND ep.user_id = auth.uid()
    )
  );

