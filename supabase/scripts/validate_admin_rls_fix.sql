-- Run after applying 010/011 to confirm no recursion and admin behavior.
-- Execute in Supabase SQL Editor (or: supabase db execute -f supabase/scripts/validate_admin_rls_fix.sql)

-- 1) is_admin_from_jwt exists and does not reference public.users
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'is_admin_from_jwt'
) AS has_is_admin_from_jwt;

-- 2) public.users admin policies should reference is_admin_from_jwt (not is_admin)
SELECT policyname,
  CASE
    WHEN qual::text LIKE '%is_admin_from_jwt%' THEN 'OK (no recursion)'
    WHEN qual::text LIKE '%is_admin()%' THEN 'FAIL: uses is_admin()'
    ELSE 'OK or N/A'
  END AS status
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users' AND policyname LIKE '%Admin%';
