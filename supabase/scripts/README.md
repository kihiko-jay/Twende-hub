# Supabase scripts

## is_admin stack depth fix

- **inspect_admin_rls.sql** – Run against your DB to see current `is_admin` / `is_admin_from_jwt` definitions and RLS policies on `public.users`. Use Supabase SQL Editor or: `supabase db execute -f supabase/scripts/inspect_admin_rls.sql`
- **validate_admin_rls_fix.sql** – Run after applying migrations 010/011 to confirm admin policies use `is_admin_from_jwt` and avoid recursion.

After deploying migration 011 (or 010), re-run the request that previously caused "stack depth limit exceeded" (e.g. `GET /rest/v1/users?id=eq.<uuid>` with an admin JWT). You should get a normal response and no need to change `max_stack_depth`.
