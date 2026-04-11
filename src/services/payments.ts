
import { apiFetch } from '@/lib/apiClient.ts';

export type PaymentType = 'creation' | 'feature' | 'participant';

export interface InitiatePaymentPayload {
  event_id: number;
  type: PaymentType;
  phone_number: string;
  amount?: number;
}

export interface InitiatePaymentResponse {
  checkout_request_id: string | null;
  message: string;
  eventId: number;
  paymentStatus: string;
  amount: number;
  phone: string;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'success' | 'failed';
  type: PaymentType;
  event_id: number;
  booking_id: number | null;
  mpesa_receipt_number: string | null;
}

export function validatePhone(value: string): boolean {
  const trimmed = value.replace(/\s+/g, '');
  return /^(07|01)\d{8}$/.test(trimmed) || /^\+254\d{9}$/.test(trimmed);
}

export async function initiatePayment(payload: InitiatePaymentPayload, token: string) {
  return apiFetch<InitiatePaymentResponse>('/api/payments/initiate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    retryCount: 1,
  });
}

export async function pollPaymentStatus(
  checkoutRequestId: string,
  token: string,
  onPending?: (attempt: number) => void,
  maxAttempts = 12,
): Promise<PaymentStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await apiFetch<PaymentStatusResponse>(`/api/payments/status/${checkoutRequestId}`, {
      headers: { Authorization: `Bearer ${token}` },
      retryCount: 1,
    });
    if (response.status === 'success' || response.status === 'failed') return response;
    onPending?.(attempt + 1);
  }
  throw new Error('Payment is taking longer than expected. Please try again.');
}
