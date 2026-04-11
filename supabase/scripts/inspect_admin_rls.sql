-- Run this against your database (e.g. Supabase SQL Editor or: supabase db execute -f supabase/scripts/inspect_admin_rls.sql)
-- to inspect whether the non-recursive is_admin pattern is applied.

-- 1) Current definition of public.is_admin()
SELECT 'public.is_admin()' AS object, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname = 'is_admin';

-- 2) Current definition of public.is_admin_from_jwt() (should exist after 010)
SELECT 'public.is_admin_from_jwt()' AS object, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname = 'is_admin_from_jwt';

-- 3) All RLS policies on public.users (USING/WITH CHECK should reference is_admin_from_jwt, NOT is_admin)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual AS using_expression, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;
