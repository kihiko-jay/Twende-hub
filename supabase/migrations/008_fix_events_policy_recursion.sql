-- 008_fix_events_policy_recursion.sql
-- Fix "infinite recursion detected in policy for relation \"events\"" by
-- simplifying the events SELECT policy to avoid circular references with
-- event_invitations.

-- Original policy "Public and invited can read active public events"
-- referenced event_invitations, whose policies in turn referenced events,
-- causing a recursive RLS evaluation.

-- 1) Drop the recursive policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'Public and invited can read active public events'
  ) THEN
    DROP POLICY "Public and invited can read active public events" ON public.events;
  END IF;
END;
$$;

-- 2) Replace with a simpler, non-recursive policy:
--    - Anyone can read active public events.
--    - Organizers and invited users still have access via other,
--      independent policies on events and event_invitations.
CREATE POLICY "Public can read active public events"
  ON public.events
  FOR SELECT
  USING (
    status = 'active'
    AND visibility = 'public'
  );

