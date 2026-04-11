import { supabase } from '@/lib/supabase.ts';
import type { Database } from '@/lib/supabase.types.ts';

type UserRow = Database['public']['Tables']['users']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type PayoutRow = Database['public']['Tables']['payouts']['Row'];

type ReportedMessageRow = Database['public']['Tables']['reported_messages']['Row'];

export interface AdminStats {
  totalUsers: number;
  totalEvents: number;
  activeEvents: number;
  pendingEvents: number;
  totalRevenueKes: number;
  pendingActions: number;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('You must be signed in as an admin.');
  }
  return data.session.access_token;
}

async function authedJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Admin request failed');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, created_at, is_suspended, phone, avatar_url')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserRow[];
}

export async function setUserSuspended(userId: string, isSuspended: boolean): Promise<void> {
  await authedJson(`/api/admin/users/${userId}/suspension`, {
    method: 'PATCH',
    body: JSON.stringify({ is_suspended: isSuspended }),
  });
}


export interface AdminEvent extends EventRow {
  organizer_name?: string | null;
}

export async function listEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`*, organizer:users!events_organizer_id_fkey ( name )`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    organizer_name: Array.isArray(row.organizer) ? row.organizer[0]?.name ?? null : row.organizer?.name ?? null,
  })) as AdminEvent[];
}

export async function approveEvent(eventId: number): Promise<void> {
  await authedJson(`/api/admin/events/${eventId}/approve`, { method: 'POST' });
}

export async function rejectEvent(eventId: number): Promise<void> {
  await authedJson(`/api/admin/events/${eventId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Rejected by admin from dashboard.' }),
  });
}

export interface AdminPayment extends PaymentRow {
  user_email?: string | null;
  event_title?: string | null;
  transaction_code?: string | null;
  phone_number?: string | null;
}

export async function listPayments(): Promise<AdminPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      user:users!payments_user_id_fkey ( email ),
      event:events!payments_event_id_fkey ( title ),
      payment_logs ( payload, created_at )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const latestPayload = Array.isArray(row.payment_logs)
      ? row.payment_logs.find((log: any) => log?.payload?.transaction_code || log?.payload?.phone_number)?.payload
      : null;
    return {
      ...row,
      user_email: Array.isArray(row.user) ? row.user[0]?.email ?? null : row.user?.email ?? null,
      event_title: Array.isArray(row.event) ? row.event[0]?.title ?? null : row.event?.title ?? null,
      transaction_code: latestPayload?.transaction_code ?? null,
      phone_number: latestPayload?.phone_number ?? null,
    };
  }) as AdminPayment[];
}

export interface AdminPayout extends PayoutRow {
  recipient_email?: string | null;
  recipient_name?: string | null;
}

export async function listPayouts(): Promise<AdminPayout[]> {
  const { data, error } = await supabase
    .from('payouts')
    .select(`*, recipient:users!payouts_recipient_user_id_fkey ( email, name )`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    recipient_email: Array.isArray(row.recipient) ? row.recipient[0]?.email ?? null : row.recipient?.email ?? null,
    recipient_name: Array.isArray(row.recipient) ? row.recipient[0]?.name ?? null : row.recipient?.name ?? null,
  })) as AdminPayout[];
}

export async function executePayout(payoutId: number): Promise<void> {
  await authedJson(`/api/admin/payouts/${payoutId}/execute`, { method: 'POST' });
}

export async function manualApprovePayment(paymentId: number): Promise<void> {
  await authedJson(`/api/admin/payments/${paymentId}/manual-approve`, { method: 'POST' });
}

export async function manualRejectPayment(paymentId: number): Promise<void> {
  await authedJson(`/api/admin/payments/${paymentId}/manual-reject`, { method: 'POST' });
}

export interface AdminReportedMessage extends ReportedMessageRow {
  chat_content?: string | null;
  reporter_name?: string | null;
  offender_name?: string | null;
}

export async function listReportedMessages(): Promise<AdminReportedMessage[]> {
  const { data, error } = await supabase
    .from('reported_messages')
    .select(`
      *,
      reporter:users!reported_messages_reported_by_fkey ( name ),
      message:chat_messages!reported_messages_message_id_fkey ( content, user_id )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    reporter_name: Array.isArray(row.reporter) ? row.reporter[0]?.name ?? null : row.reporter?.name ?? null,
    chat_content: Array.isArray(row.message) ? row.message[0]?.content ?? null : row.message?.content ?? null,
  }));
}

export async function dismissReport(reportId: number): Promise<void> {
  await authedJson(`/api/admin/reports/${reportId}`, { method: 'DELETE' });
}

export async function deleteChatMessage(messageId: number): Promise<void> {
  await authedJson(`/api/admin/chat/${messageId}`, { method: 'DELETE' });
}

export interface AdminAuditLogEntry {
  id: number;
  admin_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_name?: string | null;
}

export async function listAdminAuditLog(): Promise<AdminAuditLogEntry[]> {
  const { data, error } = await (supabase as any)
    .from('admin_audit_log')
    .select(`id, admin_user_id, action, target_type, target_id, details, created_at, admin:users!admin_audit_log_admin_user_id_fkey ( name )`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    admin_user_id: row.admin_user_id,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    details: row.details,
    created_at: row.created_at,
    admin_name: Array.isArray(row.admin) ? row.admin[0]?.name ?? null : row.admin?.name ?? null,
  })) as AdminAuditLogEntry[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const [usersCountRes, eventsRes, paymentsRes, manualPaymentsRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id, status').order('created_at', { ascending: false }),
    supabase.from('payments').select('amount, payment_status').in('payment_status', ['confirmed', 'success']),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('payment_status', 'manual_review_required' as any),
  ]);

  if (usersCountRes.error) throw usersCountRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (manualPaymentsRes.error) throw manualPaymentsRes.error;

  const totalUsers = usersCountRes.count ?? 0;
  const events = (eventsRes.data ?? []) as { id: number; status: string }[];
  const payments = (paymentsRes.data ?? []) as { amount: number; payment_status: string }[];

  const totalEvents = events.length;
  const activeEvents = events.filter((e) => e.status === 'active').length;
  const pendingEvents = events.filter((e) => e.status === 'pending_payment').length;
  const totalRevenueKes = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingActions = pendingEvents + (manualPaymentsRes.count ?? 0);

  return { totalUsers, totalEvents, activeEvents, pendingEvents, totalRevenueKes, pendingActions };
}

