export type PaymentType = 'creation' | 'feature' | 'participant';

export interface PaymentRowLite {
  id: number;
  event_id: number;
  user_id: string;
  amount: number;
  payment_type: PaymentType | string;
  payment_status: string;
  provider_payment_id: string | null;
}

export function normalizePaymentStatus(status: string | null | undefined): 'pending' | 'success' | 'failed' {
  if (status === 'confirmed' || status === 'success') return 'success';
  if (status === 'failed' || status === 'refunded') return 'failed';
  return 'pending';
}

export function extractMpesaReceipt(rawBody: unknown): string | null {
  const items = (rawBody as { Body?: { stkCallback?: { CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: string }> } } } })
    ?.Body?.stkCallback?.CallbackMetadata?.Item;
  if (!Array.isArray(items)) return null;
  const receiptItem = items.find((item) => item?.Name === 'MpesaReceiptNumber');
  return typeof receiptItem?.Value === 'string' ? receiptItem.Value : null;
}

export async function applyApprovedPaymentEffects(
  supabase: any,
  payment: { id: number; event_id: number; user_id: string; payment_type: string },
  finalizeParticipantBookingPayment: (payment: { id: number; event_id: number; user_id: string }) => Promise<void>,
): Promise<void> {
  if (payment.payment_type === 'participant') {
    await finalizeParticipantBookingPayment(payment);
    return;
  }

  if (payment.payment_type === 'feature') {
    await supabase
      .from('events')
      .update({
        is_featured: true,
        featured_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', payment.event_id);
    return;
  }

  await supabase.rpc('confirm_event_creation_payment', {
    p_event_id: payment.event_id,
  });
}
