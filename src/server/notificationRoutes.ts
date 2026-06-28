import type { Express } from 'express';
import {
  sendEmail,
  vehicleBookingRequestEmail,
  photographerBookingRequestEmail,
  activityRequestJoinEmail,
  activityRequestConvertedEmail,
} from '../lib/email.js';
import config from '../config.js';
import { log } from '../lib/logger.js';
import type { AuthMiddleware, AuthedRequest } from './types.js';

export function registerNotificationRoutes({
  app,
  supabase,
  authenticateSupabase,
}: {
  app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  authenticateSupabase: AuthMiddleware;
}) {
  app.post('/api/vehicle-bookings/:id/notify', authenticateSupabase, async (req: AuthedRequest, res) => {
    const bookingId = parseInt(req.params.id, 10);
    if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });
    try {
      const { data, error } = await supabase
        .from('vehicle_bookings')
        .select(`
          id,
          notes,
          events ( title ),
          vehicles ( make, model, owner:users!vehicles_owner_id_fkey ( email ) ),
          organizer:users!vehicle_bookings_organizer_id_fkey ( name )
        `)
        .eq('id', bookingId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Booking not found' });
      const row = data as {
        notes: string | null;
        events: { title: string } | null;
        vehicles: { make: string; model: string; owner: { email: string } | { email: string }[] | null } | null;
        organizer: { name: string } | { name: string }[] | null;
      };
      const ownerEmail = Array.isArray(row.vehicles?.owner)
        ? row.vehicles?.owner[0]?.email
        : (row.vehicles?.owner as { email: string } | null)?.email;
      if (!ownerEmail) return res.json({ status: 'ok' });
      const vehicleDesc = `${row.vehicles?.make ?? ''} ${row.vehicles?.model ?? ''}`.trim();
      const organizerName = Array.isArray(row.organizer)
        ? row.organizer[0]?.name ?? 'An organiser'
        : (row.organizer as { name: string } | null)?.name ?? 'An organiser';
      const payload = vehicleBookingRequestEmail(ownerEmail, {
        vehicleDesc,
        eventTitle: row.events?.title ?? 'Your event',
        organizerName,
        notes: row.notes ?? null,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: 'ok' });
    } catch (err) {
      log({ level: 'error', message: 'Failed to send vehicle booking email', error: err });
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.post('/api/photographer-bookings/:id/notify', authenticateSupabase, async (req: AuthedRequest, res) => {
    const bookingId = parseInt(req.params.id, 10);
    if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });
    try {
      const { data, error } = await supabase
        .from('photographer_bookings')
        .select(`
          id,
          notes,
          events ( title ),
          photographers ( users!photographers_user_id_fkey ( email ) ),
          organizer:users!photographer_bookings_organizer_id_fkey ( name )
        `)
        .eq('id', bookingId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Booking not found' });
      const row = data as {
        notes: string | null;
        events: { title: string } | null;
        photographers: { users: { email: string } | { email: string }[] | null } | null;
        organizer: { name: string } | { name: string }[] | null;
      };
      const photographerEmail = Array.isArray(row.photographers?.users)
        ? row.photographers?.users[0]?.email
        : (row.photographers?.users as { email: string } | null)?.email;
      if (!photographerEmail) return res.json({ status: 'ok' });
      const organizerName = Array.isArray(row.organizer)
        ? row.organizer[0]?.name ?? 'An organiser'
        : (row.organizer as { name: string } | null)?.name ?? 'An organiser';
      const payload = photographerBookingRequestEmail(photographerEmail, {
        eventTitle: row.events?.title ?? 'Your event',
        organizerName,
        notes: row.notes ?? null,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: 'ok' });
    } catch (err) {
      log({ level: 'error', message: 'Failed to send photographer booking email', error: err });
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.post('/api/activity-requests/:id/notify-creator', authenticateSupabase, async (req: AuthedRequest, res) => {
    const requestId = req.params.id;
    if (!requestId) return res.status(400).json({ error: 'Invalid request id' });
    try {
      const { data, error } = await supabase
        .from('activity_requests')
        .select(`
          id,
          creator:users!activity_requests_creator_id_fkey ( email ),
          activity_type,
          activity_date,
          location_name,
          min_people,
          max_people
        `)
        .eq('id', requestId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Activity request not found' });

      const { data: members } = await supabase
        .from('activity_request_members')
        .select('id')
        .eq('request_id', requestId);

      const row = data as {
        id: string;
        creator: { email: string } | { email: string }[] | null;
        activity_type: string | null;
        activity_date: string;
        location_name: string | null;
        max_people: number | null;
      };
      const email = Array.isArray(row.creator)
        ? row.creator[0]?.email
        : (row.creator as { email: string } | null)?.email;
      if (!email) return res.json({ status: 'ok' });

      const peopleJoined = (members ?? []).length;
      const maxPeople = row.max_people ?? peopleJoined;
      const activityDate = new Date(row.activity_date).toLocaleDateString('en-KE', { dateStyle: 'full' });
      const origin = config.appUrl || 'https://twende.app';
      const requestUrl = `${origin}/activity/${row.id}`;

      const payload = activityRequestJoinEmail(email, {
        activityType: row.activity_type ?? 'Your plan',
        activityDate,
        locationName: row.location_name ?? 'Your location',
        peopleJoined,
        maxPeople,
        requestUrl,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: 'ok' });
    } catch (err) {
      log({ level: 'error', message: 'Failed to send activity request join email', error: err });
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.post('/api/activity-requests/:id/notify-converted', authenticateSupabase, async (req: AuthedRequest, res) => {
    const requestId = req.params.id;
    if (!requestId) return res.status(400).json({ error: 'Invalid request id' });
    try {
      const { data, error } = await supabase
        .from('activity_requests')
        .select(`
          id,
          creator:users!activity_requests_creator_id_fkey ( email ),
          activity_type,
          activity_date,
          location_name,
          event_id
        `)
        .eq('id', requestId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Activity request not found' });
      const row = data as {
        id: string;
        creator: { email: string } | { email: string }[] | null;
        activity_type: string | null;
        activity_date: string;
        location_name: string | null;
        event_id: number | null;
      };
      if (!row.event_id) return res.status(400).json({ error: 'Request has not been converted to an event' });

      const email = Array.isArray(row.creator)
        ? row.creator[0]?.email
        : (row.creator as { email: string } | null)?.email;
      if (!email) return res.json({ status: 'ok' });

      const activityDate = new Date(row.activity_date).toLocaleDateString('en-KE', { dateStyle: 'full' });
      const origin = config.appUrl || 'https://twende.app';
      const eventUrl = `${origin}/events/${row.event_id}`;

      const payload = activityRequestConvertedEmail(email, {
        activityType: row.activity_type ?? 'Your plan',
        activityDate,
        locationName: row.location_name ?? 'Your location',
        eventUrl,
      });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: 'ok' });
    } catch (err) {
      log({ level: 'error', message: 'Failed to send activity request converted email', error: err });
      res.status(500).json({ error: 'Failed to send email' });
    }
  });
}
