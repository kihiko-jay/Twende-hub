-- 002_monetization_upgrade.sql
-- Extend Eventjump schema with commissions, payouts, and admin logs.

-- ============================
-- 1) ENUM EXTENSIONS
-- ============================

-- Add a refunded state for payments if not already present
ALTER TYPE payment_status
  ADD VALUE IF NOT EXISTS 'refunded';

-- ============================
-- 2) EXTEND public.payments
-- ============================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS organizer_earnings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'payments_commission_non_negative'
           AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_commission_non_negative
      CHECK (
        platform_fee >= 0
        AND organizer_earnings >= 0
        AND platform_fee + organizer_earnings <= amount
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_payments_status_created_at
  ON public.payments (payment_status, created_at);

-- ============================
-- 3) EXTEND service booking tables
--     photographer_bookings, vehicle_bookings
-- ============================

ALTER TABLE public.photographer_bookings
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_earnings INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'photographer_bookings_commission_non_negative'
           AND conrelid = 'public.photographer_bookings'::regclass
  ) THEN
    ALTER TABLE public.photographer_bookings
      ADD CONSTRAINT photographer_bookings_commission_non_negative
      CHECK (platform_fee >= 0 AND provider_earnings >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_photographer_bookings_status_created_at
  ON public.photographer_bookings (status, created_at);

ALTER TABLE public.vehicle_bookings
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_earnings INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'vehicle_bookings_commission_non_negative'
           AND conrelid = 'public.vehicle_bookings'::regclass
  ) THEN
    ALTER TABLE public.vehicle_bookings
      ADD CONSTRAINT vehicle_bookings_commission_non_negative
      CHECK (platform_fee >= 0 AND provider_earnings >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_vehicle_bookings_status_created_at
  ON public.vehicle_bookings (status, created_at);

-- ============================
-- 4) New payouts table
-- ============================

CREATE TABLE IF NOT EXISTS public.payouts (
  id BIGSERIAL PRIMARY KEY,
  recipient_user_id UUID NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payouts_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payouts_recipient_user
  ON public.payouts (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_payouts_status_created_at
  ON public.payouts (status, created_at);

CREATE INDEX IF NOT EXISTS idx_payouts_scheduled_for
  ON public.payouts (scheduled_for);

-- ============================
-- 5) New admin_logs table
-- ============================

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_created_at
  ON public.admin_logs (admin_id, created_at);

CREATE INDEX IF NOT EXISTS idx_admin_logs_entity
  ON public.admin_logs (entity_type, entity_id);

