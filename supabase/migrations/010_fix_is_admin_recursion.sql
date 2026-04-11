-- 010_fix_is_admin_recursion.sql
-- Break recursive RLS on public.users by introducing a JWT-only admin helper
-- and updating policies to avoid calling is_admin() when querying public.users.

-- 1) JWT-only admin helper for use inside public.users RLS.
CREATE OR REPLACE FUNCTION public.is_admin_from_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.jwt() ->> 'role', '') = 'admin';
$$;

-- 2) Re-define is_admin() to delegate JWT check to is_admin_from_jwt()
--    and still support role stored in public.users for non-RLS contexts.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
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

-- 3) Replace admin policies on public.users to use is_admin_from_jwt()
--    so that RLS on public.users never needs to query public.users again.
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

