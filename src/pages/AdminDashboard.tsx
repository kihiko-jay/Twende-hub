import React, { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal.tsx';
import {
  approveEvent,
  rejectEvent,
  listUsers,
  setUserSuspended,
  listEvents,
  listPayments,
  listPayouts,
  getAdminStats,
  listAdminAuditLog,
  executePayout,
  manualApprovePayment,
  manualRejectPayment,
  listReportedMessages,
  dismissReport,
  deleteChatMessage,
  type AdminEvent,
  type AdminPayment,
  type AdminPayout,
  type AdminAuditLogEntry,
  type AdminStats,
  type AdminReportedMessage,
} from '@/services/admin.ts';

type Tab = 'events' | 'users' | 'payments' | 'payouts' | 'reports' | 'audit';
type ActionKind = 'approve' | 'reject' | 'suspend' | 'executePayout' | 'approvePayment' | 'rejectPayment' | 'dismissReport' | 'deleteMessage';

interface ModalState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  action?: () => Promise<void>;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listUsers>>>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [reports, setReports] = useState<AdminReportedMessage[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'manual_review_required'>('all');
  const [modal, setModal] = useState<ModalState>({ open: false, title: '', message: '', confirmLabel: '' });

  async function refresh(tab = activeTab) {
    setLoading(true);
    setError(null);
    try {
      const statsPromise = getAdminStats().then(setStats).catch(() => undefined);
      if (tab === 'events') setEvents(await listEvents());
      if (tab === 'users') setUsers(await listUsers());
      if (tab === 'payments') setPayments(await listPayments());
      if (tab === 'payouts') setPayouts(await listPayouts());
      if (tab === 'reports') setReports(await listReportedMessages());
      if (tab === 'audit') setAuditLog(await listAdminAuditLog());
      await statsPromise;
    } catch (e: any) {
      setError(e.message ?? 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const manualReviewCount = useMemo(
    () => payments.filter((p) => p.payment_status === ('manual_review_required' as any)).length,
    [payments],
  );

  const visiblePayments = useMemo(() => {
    if (paymentFilter === 'manual_review_required') {
      return payments.filter((p) => p.payment_status === ('manual_review_required' as any));
    }
    return payments;
  }, [payments, paymentFilter]);

  function ask(title: string, message: string, confirmLabel: string, action: () => Promise<void>, danger = false) {
    setModal({ open: true, title, message, confirmLabel, action, danger });
  }

  async function runModalAction() {
    if (!modal.action) return;
    try {
      await modal.action();
      setModal({ open: false, title: '', message: '', confirmLabel: '' });
      await refresh(activeTab);
    } catch (e: any) {
      setError(e.message ?? 'Action failed');
    }
  }

  const tabs: Tab[] = ['events', 'users', 'payments', 'payouts', 'reports', 'audit'];

  return (
    <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Admin dashboard</h1>
          <p className="text-stone-500 mt-2">Moderation, payments, payouts, and operational control for TwendeHub.</p>
        </div>
        <button className="olive-button px-4 py-2 text-sm" onClick={() => void refresh(activeTab)}>
          Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Users" value={String(stats.totalUsers)} />
          <StatCard label="Events" value={`${stats.totalEvents}`} sub={`${stats.activeEvents} active / ${stats.pendingEvents} pending`} />
          <StatCard label="Revenue" value={`KES ${stats.totalRevenueKes.toLocaleString()}`} />
          <StatCard label="Pending Actions" value={String(stats.pendingActions)} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${activeTab === tab ? 'bg-olive-drab text-white' : 'bg-stone-100 text-stone-700'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'payments' && manualReviewCount > 0 ? ` (${manualReviewCount} review)` : ''}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="mb-4 text-sm text-stone-500">Loading…</div>}

      {activeTab === 'events' && (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 uppercase text-xs tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Organizer</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium text-stone-800">{event.title}</td>
                  <td className="px-4 py-3 text-stone-600">{event.organizer_name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize">{event.status}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button className="px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold" onClick={() => ask('Approve event', `Approve “${event.title}”?`, 'Approve', async () => { await approveEvent(event.id); })}>Approve</button>
                    <button className="px-3 py-2 rounded-full bg-red-50 text-red-700 text-xs font-semibold" onClick={() => ask('Reject event', `Reject “${event.title}”?`, 'Reject', async () => { await rejectEvent(event.id); }, true)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 uppercase text-xs tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium text-stone-800">{user.name}</td>
                  <td className="px-4 py-3 text-stone-600">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">{user.is_suspended ? 'Suspended' : 'Active'}</td>
                  <td className="px-4 py-3">
                    <button className="px-3 py-2 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold" onClick={() => ask(user.is_suspended ? 'Unsuspend user' : 'Suspend user', `${user.is_suspended ? 'Restore' : 'Suspend'} ${user.name}?`, user.is_suspended ? 'Unsuspend' : 'Suspend', async () => { await setUserSuspended(user.id, !user.is_suspended); }, !user.is_suspended)}>
                      {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button className={`px-3 py-2 rounded-full text-xs font-semibold ${paymentFilter === 'all' ? 'bg-olive-drab text-white' : 'bg-stone-100 text-stone-700'}`} onClick={() => setPaymentFilter('all')}>All payments</button>
            <button className={`px-3 py-2 rounded-full text-xs font-semibold ${paymentFilter === 'manual_review_required' ? 'bg-amber-500 text-black' : 'bg-stone-100 text-stone-700'}`} onClick={() => setPaymentFilter('manual_review_required')}>Pending review</button>
          </div>
          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 uppercase text-xs tracking-widest">
                <tr>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Transaction</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment) => (
                  <tr key={payment.id} className="border-t border-stone-100 align-top">
                    <td className="px-4 py-3 font-medium text-stone-800">{payment.event_title ?? `Event #${payment.event_id}`}</td>
                    <td className="px-4 py-3 text-stone-600">{payment.user_email ?? payment.user_id}</td>
                    <td className="px-4 py-3">KES {Number(payment.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{payment.payment_status}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      <div>{payment.transaction_code ?? '—'}</div>
                      <div>{payment.phone_number ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {payment.payment_status === ('manual_review_required' as any) && (
                        <>
                          <button className="px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold" onClick={() => ask('Approve manual payment', `Approve payment #${payment.id}?`, 'Approve', async () => { await manualApprovePayment(payment.id); })}>Approve</button>
                          <button className="px-3 py-2 rounded-full bg-red-50 text-red-700 text-xs font-semibold" onClick={() => ask('Reject manual payment', `Reject payment #${payment.id}?`, 'Reject', async () => { await manualRejectPayment(payment.id); }, true)}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 uppercase text-xs tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Recipient</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Receipt / Failure</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800">{payout.recipient_name ?? 'Recipient'}</div>
                    <div className="text-xs text-stone-500">{payout.recipient_email ?? payout.recipient_user_id}</div>
                  </td>
                  <td className="px-4 py-3">KES {Number(payout.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">
                    {payout.status === 'verifying' ? 'Pending M-Pesa confirmation' : payout.status}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {(payout as any).mpesa_receipt_number ? <span className="text-emerald-700">{(payout as any).mpesa_receipt_number}</span> : null}
                    {(payout as any).failure_reason ? <span className="text-red-700">{(payout as any).failure_reason}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {payout.status === 'pending' && (
                      <button className="px-3 py-2 rounded-full bg-olive-drab text-white text-xs font-semibold" onClick={() => ask('Execute payout', `Send KES ${Number(payout.amount).toLocaleString()} to ${payout.recipient_name ?? payout.recipient_email ?? 'this recipient'} via M-Pesa?`, 'Execute payout', async () => { await executePayout(payout.id); })}>Execute Payout</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 uppercase text-xs tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Reporter</th>
                <th className="px-4 py-3 text-left">Message</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-stone-100 align-top">
                  <td className="px-4 py-3 font-medium text-stone-800">{report.reporter_name ?? report.reported_by}</td>
                  <td className="px-4 py-3 text-stone-700 max-w-md">{report.chat_content ?? 'Message deleted'}</td>
                  <td className="px-4 py-3 text-stone-600">{report.reason ?? 'No reason provided'}</td>
                  <td className="px-4 py-3 text-stone-500">{new Date(report.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button className="px-3 py-2 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold" onClick={() => ask('Dismiss report', 'Dismiss this report without deleting the message?', 'Dismiss', async () => { await dismissReport(report.id); })}>Dismiss</button>
                    <button className="px-3 py-2 rounded-full bg-red-50 text-red-700 text-xs font-semibold" onClick={() => ask('Delete message', 'Delete the underlying chat message for this report?', 'Delete message', async () => { await deleteChatMessage(report.message_id); }, true)}>Delete Message</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 uppercase text-xs tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Admin</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry) => (
                <tr key={entry.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-500">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-stone-700">{entry.admin_name ?? entry.admin_user_id ?? 'System'}</td>
                  <td className="px-4 py-3 font-medium text-stone-800">{entry.action}</td>
                  <td className="px-4 py-3 text-stone-600">{entry.target_type} / {entry.target_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        confirmLabel={modal.confirmLabel}
        confirmVariant={modal.danger ? 'danger' : 'warning'}
        onCancel={() => setModal({ open: false, title: '', message: '', confirmLabel: '' })}
        onConfirm={() => void runModalAction()}
      />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-stone-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-stone-500">{sub}</div> : null}
    </div>
  );
}
