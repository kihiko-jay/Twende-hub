-- 014_payments_and_admin_audit.sql
-- Payment hardening (idempotency, logs, booking link, raw payload)
-- and dedicated admin_audit_log table for admin UX.

SET search_path TO public;

-- 1) Extend payments with booking linkage and raw payload

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS booking_id BIGINT REFERENCES public.event_participants(id),
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Ensure transaction_reference remains a unique idempotency key (created in 001).
-- Add uniqueness on provider_payment_id (Mpesa receipt) where present.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'payments_provider_payment_id_key'
           AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_provider_payment_id_key
      UNIQUE (provider_payment_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_payments_booking_id
  ON public.payments (booking_id);


-- 2) payment_logs table for webhook/API call logging

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  endpoint TEXT,
  status_code INT,
  payload JSONB,
  headers JSONB,
  error TEXT,
  payment_id BIGINT NULL REFERENCES public.payments(id)
);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all payment_logs; service role / backend can insert via service key.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_logs'
      AND policyname = 'Admins can read payment_logs'
  ) THEN
    CREATE POLICY "Admins can read payment_logs"
      ON public.payment_logs
      FOR SELECT
      USING (public.is_admin());
  END IF;
END;
$$;


-- 3) admin_audit_log for explicit admin UX actions

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'event', 'payment', etc.
  target_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'Admins can read admin_audit_log'
  ) THEN
    CREATE POLICY "Admins can read admin_audit_log"
      ON public.admin_audit_log
      FOR SELECT
      USING (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'Admins can insert admin_audit_log'
  ) THEN
    CREATE POLICY "Admins can insert admin_audit_log"
      ON public.admin_audit_log
      FOR INSERT
      WITH CHECK (public.is_admin());
  END IF;
END;
$$;

