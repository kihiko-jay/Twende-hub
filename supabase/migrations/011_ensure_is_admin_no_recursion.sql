-- 011_ensure_is_admin_no_recursion.sql
-- Idempotent re-application of the is_admin recursion fix (same as 010).
-- Run this on any database where migration 010 was skipped or reverted to fix
-- "stack depth limit exceeded" when querying public.users via PostgREST.

-- 1) JWT-only admin helper for use inside public.users RLS (no table access).
CREATE OR REPLACE FUNCTION public.is_admin_from_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'role', '') = 'admin';
$$;

-- 2) is_admin() for use on other tables: JWT first, then fallback to public.users.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_admin_from_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    );
$$;

-- 3) public.users RLS must use only is_admin_from_jwt() to avoid recursion.
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  USING (public.is_admin_from_jwt());

CREATE POLICY "Admins can manage users"
  ON public.users
  FOR UPDATE
  USING (public.is_admin_from_jwt())
  WITH CHECK (public.is_admin_from_jwt());
