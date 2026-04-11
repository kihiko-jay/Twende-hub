import { sendEmail, eventApprovedEmail, eventRejectedEmail } from '../lib/email.js';
import config from '../config.js';
import type { AuthMiddleware, AuthedRequest } from './types.js';

interface AdminRouteDeps {
  app: any;
  supabase: any;
  authenticateSupabase: AuthMiddleware;
  getAdminUser: (req: AuthedRequest) => Promise<{ id: string; role: string }>;
  finalizeParticipantBookingPayment: (payment: { id: number; event_id: number; user_id: string }) => Promise<void>;
  applyApprovedPaymentEffects: (
    supabase: any,
    payment: { id: number; event_id: number; user_id: string; payment_type: string },
    finalizeParticipantBookingPayment: (payment: { id: number; event_id: number; user_id: string }) => Promise<void>,
  ) => Promise<void>;
}

export function registerAdminRoutes({
  app,
  supabase,
  authenticateSupabase,
  getAdminUser,
  finalizeParticipantBookingPayment,
  applyApprovedPaymentEffects,
}: AdminRouteDeps) {
  app.patch('/api/admin/users/:id/suspension', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const userId = req.params.id;
      const isSuspended = Boolean(req.body?.is_suspended);
      const { error } = await supabase.from('users').update({ is_suspended: isSuspended }).eq('id', userId);
      if (error) return res.status(500).json({ error: 'Failed to update user status' });
      await supabase.from('admin_audit_log').insert({
        admin_user_id: admin.id,
        action: isSuspended ? 'suspend_user' : 'unsuspend_user',
        target_type: 'user',
        target_id: userId,
        details: { is_suspended: isSuspended },
      });
      return res.json({ status: 'ok' });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to update suspension state' });
    }
  });

  app.post('/api/admin/events/:id/approve', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const eventId = parseInt(req.params.id, 10);
      if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

      const { data, error } = await supabase
        .from('events')
        .update({ status: 'active' })
        .eq('id', eventId)
        .select('id, title, organizer:users!events_organizer_id_fkey(email)')
        .single();
      if (error || !data) return res.status(404).json({ error: 'Event not found' });

      await supabase.from('admin_audit_log').insert({
        admin_user_id: admin.id,
        action: 'approve_event',
        target_type: 'event',
        target_id: String(eventId),
        details: null,
      });

      const row = data as any;
      const email = Array.isArray(row.organizer) ? row.organizer[0]?.email : row.organizer?.email;
      if (email) {
        const payload = eventApprovedEmail(email, { eventTitle: row.title, eventId });
        await sendEmail(payload.to, payload.subject, payload.html);
      }
      return res.json({ status: 'ok' });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to approve event' });
    }
  });

  app.post('/api/admin/events/:id/reject', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const eventId = parseInt(req.params.id, 10);
      const reason = (req.body?.reason as string) || 'Rejected by admin from dashboard.';
      if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

      const { data, error } = await supabase
        .from('events')
        .update({ status: 'cancelled' })
        .eq('id', eventId)
        .select('id, title, organizer:users!events_organizer_id_fkey(email)')
        .single();
      if (error || !data) return res.status(404).json({ error: 'Event not found' });

      await supabase.from('admin_audit_log').insert({
        admin_user_id: admin.id,
        action: 'reject_event',
        target_type: 'event',
        target_id: String(eventId),
        details: { reason },
      });

      const row = data as any;
      const email = Array.isArray(row.organizer) ? row.organizer[0]?.email : row.organizer?.email;
      if (email) {
        const payload = eventRejectedEmail(email, { eventTitle: row.title, reason });
        await sendEmail(payload.to, payload.subject, payload.html);
      }
      return res.json({ status: 'ok' });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to reject event' });
    }
  });

  app.post('/api/admin/payments/:id/manual-approve', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const paymentId = parseInt(req.params.id, 10);
      if (!paymentId) return res.status(400).json({ error: 'Invalid payment id' });

      const { data: payment, error } = await supabase
        .from('payments')
        .select('id, event_id, user_id, payment_type, payment_status, provider_payment_id, amount')
        .eq('id', paymentId)
        .single();
      if (error || !payment) return res.status(404).json({ error: 'Payment not found' });
      if (payment.payment_status === 'confirmed' || payment.payment_status === 'success') {
        return res.json({ status: 'confirmed', already_processed: true });
      }

      await supabase
        .from('payments')
        .update({ payment_status: 'confirmed', processed_at: new Date().toISOString() })
        .eq('id', paymentId);

      await supabase.from('payment_logs').insert({
        direction: 'incoming',
        endpoint: '/api/admin/payments/:id/manual-approve',
        status_code: 200,
        payload: { approved_by: admin.id, payment_type: payment.payment_type, amount: payment.amount },
        headers: null,
        error: null,
        payment_id: payment.id,
      });

      await applyApprovedPaymentEffects(supabase, payment, finalizeParticipantBookingPayment);

      await supabase.from('admin_audit_log').insert({
        admin_user_id: admin.id,
        action: 'manual_approve_payment',
        target_type: 'payment',
        target_id: String(paymentId),
        details: { event_id: payment.event_id, payment_type: payment.payment_type },
      });
      return res.json({ status: 'confirmed', payment_type: payment.payment_type });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to approve payment' });
    }
  });

  app.post('/api/admin/payments/:id/manual-reject', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const paymentId = parseInt(req.params.id, 10);
      if (!paymentId) return res.status(400).json({ error: 'Invalid payment id' });

      const { data: payment, error } = await supabase
        .from('payments')
        .select('id, event_id, payment_type')
        .eq('id', paymentId)
        .single();
      if (error || !payment) return res.status(404).json({ error: 'Payment not found' });

      await supabase.from('payments').update({ payment_status: 'failed', processed_at: new Date().toISOString() }).eq('id', paymentId);
      if (payment.payment_type === 'creation') {
        await supabase.rpc('fail_event_creation_payment', {
          p_event_id: payment.event_id,
          p_error_code: 'MANUAL_REJECTED',
          p_error_message: 'Rejected by admin during manual review',
        });
      }

      await supabase.from('payment_logs').insert({
        direction: 'incoming',
        endpoint: '/api/admin/payments/:id/manual-reject',
        status_code: 200,
        payload: { rejected_by: admin.id, payment_type: payment.payment_type },
        headers: null,
        error: 'Rejected by admin during manual review',
        payment_id: payment.id,
      });
      await supabase.from('admin_audit_log').insert({ admin_user_id: admin.id, action: 'manual_reject_payment', target_type: 'payment', target_id: String(paymentId), details: { payment_type: payment.payment_type, event_id: payment.event_id } });
      return res.json({ status: 'failed', payment_type: payment.payment_type });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to reject payment' });
    }
  });

  app.delete('/api/admin/reports/:id', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const reportId = parseInt(req.params.id, 10);
      if (!reportId) return res.status(400).json({ error: 'Invalid report id' });
      await supabase.from('reported_messages').delete().eq('id', reportId);
      await supabase.from('admin_audit_log').insert({ admin_user_id: admin.id, action: 'dismiss_report', target_type: 'reported_message', target_id: String(reportId), details: null });
      return res.status(204).send();
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to dismiss report' });
    }
  });

  app.delete('/api/admin/chat/:messageId', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    try {
      const admin = await getAdminUser(req);
      const messageId = parseInt(req.params.messageId, 10);
      if (!messageId) return res.status(400).json({ error: 'Invalid message id' });
      await supabase.from('chat_messages').delete().eq('id', messageId);
      await supabase.from('reported_messages').delete().eq('message_id', messageId);
      await supabase.from('admin_audit_log').insert({ admin_user_id: admin.id, action: 'delete_chat_message', target_type: 'chat_message', target_id: String(messageId), details: null });
      return res.status(204).send();
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to delete chat message' });
    }
  });

  app.post('/api/admin/events/:id/approve-email', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can send approval emails' });
    const eventId = parseInt(req.params.id, 10);
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });
    try {
      const { data } = await supabase
        .from('events')
        .select('id, title, organizer:users!events_organizer_id_fkey(email)')
        .eq('id', eventId)
        .single();
      if (!data) return res.status(404).json({ error: 'Event not found' });
      const row = data as any;
      const email = Array.isArray(row.organizer) ? row.organizer[0]?.email : row.organizer?.email;
      if (!email) return res.status(200).json({ status: 'ok' });
      const payload = eventApprovedEmail(email, { eventTitle: row.title, eventId });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: 'ok' });
    } catch (e: any) {
      console.error('Failed to send event approved email', e?.message || e);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.post('/api/admin/events/:id/reject-email', authenticateSupabase, async (req: AuthedRequest, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can send rejection emails' });
    const eventId = parseInt(req.params.id, 10);
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });
    const reason = (req.body?.reason as string) || 'Your event does not meet our current guidelines.';
    try {
      const { data } = await supabase
        .from('events')
        .select('id, title, organizer:users!events_organizer_id_fkey(email)')
        .eq('id', eventId)
        .single();
      if (!data) return res.status(404).json({ error: 'Event not found' });
      const row = data as any;
      const email = Array.isArray(row.organizer) ? row.organizer[0]?.email : row.organizer?.email;
      if (!email) return res.status(200).json({ status: 'ok' });
      const payload = eventRejectedEmail(email, { eventTitle: row.title, reason });
      await sendEmail(payload.to, payload.subject, payload.html);
      res.json({ status: 'ok' });
    } catch (e: any) {
      console.error('Failed to send event rejected email', e?.message || e);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });
}
