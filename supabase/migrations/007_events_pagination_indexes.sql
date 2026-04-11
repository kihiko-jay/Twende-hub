-- 007_events_pagination_indexes.sql
-- Additional indexes and query helpers for events, reviews, and bookings.

-- Composite index to support listEvents filters (status + date + category + type)
CREATE INDEX IF NOT EXISTS idx_events_status_date_category_type
  ON public.events (status, date_time DESC, category, type);

-- Index to speed up text search on title/description using trigram if available.
-- Optional, safe no-op if pg_trgm is not installed.
DO $$
BEGIN
  PERFORM 1
  FROM pg_extension
  WHERE extname = 'pg_trgm';

  IF FOUND THEN
    CREATE INDEX IF NOT EXISTS idx_events_title_trgm
      ON public.events
      USING gin (title gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_events_description_trgm
      ON public.events
      USING gin (description gin_trgm_ops);
  END IF;
END;
$$;

-- Reviews listing by event + created_at
CREATE INDEX IF NOT EXISTS idx_reviews_event_created_at
  ON public.reviews (event_id, created_at DESC);

-- Bookings listing by event for transport/photography tabs
CREATE INDEX IF NOT EXISTS idx_vehicle_bookings_event_created_at
  ON public.vehicle_bookings (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_photographer_bookings_event_created_at
  ON public.photographer_bookings (event_id, created_at DESC);

