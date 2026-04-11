SET search_path TO public;

CREATE POLICY "Organisers can read participants of their events"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep
      JOIN public.events e ON e.id = ep.event_id
      WHERE ep.user_id = users.id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Participants can see co-participants basic profile"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep1
      JOIN public.event_participants ep2 ON ep1.event_id = ep2.event_id
      WHERE ep1.user_id = auth.uid()
        AND ep2.user_id = users.id
        AND ep1.booking_status = 'confirmed'
        AND ep2.booking_status = 'confirmed'
    )
  );
