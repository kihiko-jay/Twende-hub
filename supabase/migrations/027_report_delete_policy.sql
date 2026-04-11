
SET search_path TO public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reported_messages'
      AND policyname = 'Admins can delete reports'
  ) THEN
    CREATE POLICY "Admins can delete reports"
      ON public.reported_messages FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
