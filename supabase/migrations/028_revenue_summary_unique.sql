
SET search_path TO public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'revenue_summary_organizer_event_period_unique'
  ) THEN
    ALTER TABLE public.revenue_summary
      ADD CONSTRAINT revenue_summary_organizer_event_period_unique
      UNIQUE (organizer_id, event_id, period_start);
  END IF;
END $$;
