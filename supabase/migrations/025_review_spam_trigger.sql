SET search_path TO public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_comment_length'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_comment_length CHECK (comment IS NULL OR LENGTH(comment) <= 1000);
  END IF;
END $$;
