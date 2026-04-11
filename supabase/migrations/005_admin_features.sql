-- 005_admin_features.sql
-- Admin features: admin helper, RLS for admin access, and user suspension.

-- 1) Harden is_admin helper to also trust public.users.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- Prefer explicit JWT role if present
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    );
$$;

-- 2) User suspension flag
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- 3) Enable RLS for payouts and admin_logs
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- 4) Admin policies on core tables

-- Users: admins can read and update any user (including role and suspension)
CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage users"
  ON public.users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Events: admins can read and update all events (e.g. approve / reject)
CREATE POLICY "Admins can read all events"
  ON public.events
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage events"
  ON public.events
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Payments: admins can read and update all payments
CREATE POLICY "Admins can read all payments"
  ON public.payments
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage payments"
  ON public.payments
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Payouts: recipients see their own, admins see and manage all
CREATE POLICY "Recipients can read own payouts"
  ON public.payouts
  FOR SELECT
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Admins can read all payouts"
  ON public.payouts
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage payouts"
  ON public.payouts
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin logs: only admins can read and insert
CREATE POLICY "Admins can read admin_logs"
  ON public.admin_logs
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert admin_logs"
  ON public.admin_logs
  FOR INSERT
  WITH CHECK (public.is_admin());

