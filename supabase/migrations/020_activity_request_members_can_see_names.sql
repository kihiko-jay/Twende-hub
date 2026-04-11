-- 1) Anyone can see who has joined an open activity request (for participant count and list).
--    Names are still only visible to co-participants via the users policy below.
CREATE POLICY "Anyone can view members of open activity requests"
  ON public.activity_request_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_requests ar
      WHERE ar.id = request_id AND ar.status = 'open'
    )
  );

-- 2) Allow users to read id and name of other users who are in the same activity request.
--    This lets participants see each other's names on the Instant Group Adventure detail page.
CREATE POLICY "Users can read names of co-participants in activity requests"
  ON public.users
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.activity_request_members arm1
      JOIN public.activity_request_members arm2
        ON arm1.request_id = arm2.request_id AND arm2.user_id = auth.uid()
      WHERE arm1.user_id = users.id
    )
  );
