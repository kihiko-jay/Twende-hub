SET search_path TO public;

DO $$
BEGIN
  ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'participant';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
