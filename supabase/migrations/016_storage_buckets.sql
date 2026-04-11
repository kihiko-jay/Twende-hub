-- 016_storage_buckets.sql
-- Public storage buckets for images and user avatars.

SET search_path TO public;

-- 1) Buckets

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('event-covers', 'event-covers', true),
  ('vehicle-images', 'vehicle-images', true),
  ('photographer-portfolios', 'photographer-portfolios', true)
ON CONFLICT (id) DO NOTHING;


-- 2) RLS policies on storage.objects
-- Authenticated users can upload to paths prefixed with their user id.
-- Everyone can read publicly available images.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can read images'
  ) THEN
    CREATE POLICY "Public can read images"
      ON storage.objects
      FOR SELECT
      USING (bucket_id IN ('event-covers', 'vehicle-images', 'photographer-portfolios'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own images'
  ) THEN
    CREATE POLICY "Users can upload own images"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id IN ('event-covers', 'vehicle-images', 'photographer-portfolios')
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END;
$$;


-- 3) Avatar URL on users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

