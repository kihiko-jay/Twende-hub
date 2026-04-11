
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/lib/apiClient.ts', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe('payments service', async () => {
  const { initiatePayment, pollPaymentStatus, validatePhone } = await import('../payments');

  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('validates Kenyan phone formats', () => {
    expect(validatePhone('0712345678')).toBe(true);
    expect(validatePhone('0112345678')).toBe(true);
    expect(validatePhone('+254712345678')).toBe(true);
    expect(validatePhone('123456')).toBe(false);
    expect(validatePhone('+15555555555')).toBe(false);
  });

  it('sends correct payloads for creation, feature, and participant', async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    await initiatePayment({ event_id: 1, type: 'creation', phone_number: '0712345678' }, 'token-a');
    await initiatePayment({ event_id: 2, type: 'feature', phone_number: '0712345678' }, 'token-b');
    await initiatePayment({ event_id: 3, type: 'participant', phone_number: '0712345678', amount: 2500 }, 'token-c');

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/payments/initiate', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer token-a' },
      body: JSON.stringify({ event_id: 1, type: 'creation', phone_number: '0712345678' }),
    }));
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/payments/initiate', expect.objectContaining({
      headers: { Authorization: 'Bearer token-b' },
      body: JSON.stringify({ event_id: 2, type: 'feature', phone_number: '0712345678' }),
    }));
    expect(apiFetchMock).toHaveBeenNthCalledWith(3, '/api/payments/initiate', expect.objectContaining({
      headers: { Authorization: 'Bearer token-c' },
      body: JSON.stringify({ event_id: 3, type: 'participant', phone_number: '0712345678', amount: 2500 }),
    }));
  });

  it('stops polling after success', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'success', event_id: 4, booking_id: 9, mpesa_receipt_number: 'ABC123', type: 'participant' });

    const result = await pollPaymentStatus('checkout-1', 'token');

    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('success');
  });

  it('terminates after 12 attempts', async () => {
    apiFetchMock.mockResolvedValue({ status: 'pending', event_id: 4, booking_id: null, mpesa_receipt_number: null, type: 'creation' });

    await expect(pollPaymentStatus('checkout-2', 'token')).rejects.toThrow(/longer than expected/i);
    expect(apiFetchMock).toHaveBeenCalledTimes(12);
  });
});
