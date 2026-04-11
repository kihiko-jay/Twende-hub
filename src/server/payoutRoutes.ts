import type { Express, Request, Response } from 'express';
import config from '../config.js';
import type { AuthMiddleware, AuthedRequest } from './types.js';
import { isValidKenyanPhone, normalizeKenyanPhone, requireSafaricomIpAllowlist } from './paymentUtils.js';

interface PayoutRouteDeps {
  app: Express;
  supabase: any;
  authenticateSupabase: AuthMiddleware;
  getAdminUser: (req: AuthedRequest) => Promise<{ id: string; role: string }>;
  getMpesaAccessToken: () => Promise<string>;
  logPayoutTraffic: (payload: {
    payout_id?: number | null;
    direction: string;
    endpoint: string;
    status_code: number;
    payload: unknown;
    error?: string | null;
  }) => Promise<void>;
}

export function registerPayoutRoutes({
  app,
  supabase,
  authenticateSupabase,
  getAdminUser,
  getMpesaAccessToken,
  logPayoutTraffic,
}: PayoutRouteDeps) {
  app.post('/api/admin/payouts/:id/execute', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      await getAdminUser(req as AuthedRequest);
      const payoutId = parseInt((req.params as { id?: string }).id ?? '', 10);
      if (!payoutId) return res.status(400).json({ error: 'Invalid payout id' });

      const { data: payout } = await supabase.from('payouts').select('*').eq('id', payoutId).single();
      if (!payout) return res.status(404).json({ error: 'Payout not found' });
      if (payout.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending payouts can be executed' });
      }

      if (payout.event_id) {
        const { data: eventRow } = await supabase.from('events').select('status').eq('id', payout.event_id).maybeSingle();
        if (eventRow?.status === 'cancelled') {
          await supabase.from('payouts').update({ status: 'failed', failure_reason: 'Event was cancelled before payout execution.' }).eq('id', payoutId);
          return res.status(400).json({ error: 'Cannot execute payout for a cancelled event' });
        }
      }

      const { data: recipient } = await supabase.from('users').select('phone, name').eq('id', payout.recipient_user_id).single();
      if (!recipient?.phone || !isValidKenyanPhone(recipient.phone)) {
        return res.status(400).json({ error: 'Recipient does not have a valid Kenyan phone number' });
      }

      if (!config.isProd || !config.b2cEnabled) {
        await supabase.from('payouts').update({ status: 'confirmed', processed_at: new Date().toISOString() }).eq('id', payoutId);
        await logPayoutTraffic({ payout_id: payoutId, direction: 'outgoing', endpoint: '/api/admin/payouts/:id/execute', status_code: 200, payload: { mode: 'mock', amount: payout.amount } });
        return res.json({ status: 'confirmed' });
      }

      const accessToken = await getMpesaAccessToken();
      const payload = {
        InitiatorName: config.mpesaB2CInitiatorName,
        SecurityCredential: config.mpesaB2CSecurityCredential,
        CommandID: 'BusinessPayment',
        Amount: Math.round(Number(payout.amount)),
        PartyA: config.mpesaShortCode,
        PartyB: normalizeKenyanPhone(recipient.phone),
        Remarks: `TwendeHub payout ${payoutId}`,
        QueueTimeOutURL: config.mpesaB2CQueueTimeoutUrl,
        ResultURL: config.mpesaB2CResultUrl,
        Occasion: 'Organizer payout',
      };

      const response = await fetch(`${config.mpesaBaseUrl}/mpesa/b2c/v3/paymentrequest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json();
      await logPayoutTraffic({ payout_id: payoutId, direction: 'outgoing', endpoint: '/mpesa/b2c/v3/paymentrequest', status_code: response.status, payload, error: response.ok ? null : JSON.stringify(responseBody) });

      if (!response.ok || responseBody.errorCode) {
        await supabase.from('payouts').update({ status: 'failed', failure_reason: responseBody.errorMessage ?? 'M-Pesa B2C request failed' }).eq('id', payoutId);
        return res.status(502).json({ error: 'Failed to execute payout' });
      }

      await supabase.from('payouts').update({ status: 'verifying', initiator_message_id: responseBody.OriginatorConversationID ?? responseBody.ConversationID ?? null }).eq('id', payoutId);
      return res.json({ status: 'verifying' });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 500).json({ error: error?.message ?? 'Failed to execute payout' });
    }
  });

  app.post('/api/payments/b2c-result', requireSafaricomIpAllowlist, async (req: Request, res: Response) => {
    try {
      const result = req.body?.Result ?? req.body;
      const conversationId = result?.OriginatorConversationID ?? result?.ConversationID ?? null;
      const resultCode = Number(result?.ResultCode ?? -1);
      const resultDesc = String(result?.ResultDesc ?? 'Unknown result');
      const { data: payout } = await supabase.from('payouts').select('id').eq('initiator_message_id', conversationId).maybeSingle();
      const resultParameters = Array.isArray(result?.ResultParameters?.ResultParameter) ? result.ResultParameters.ResultParameter : [];
      const receiptParam = resultParameters.find((entry: { Key?: string; Value?: string }) => entry?.Key === 'TransactionReceipt');
      const receipt = typeof receiptParam?.Value === 'string' ? receiptParam.Value : null;

      if (payout?.id) {
        await supabase.from('payouts').update({
          status: resultCode === 0 ? 'confirmed' : 'failed',
          mpesa_receipt_number: resultCode === 0 ? receipt : null,
          failure_reason: resultCode === 0 ? null : resultDesc,
          processed_at: new Date().toISOString(),
        }).eq('id', payout.id);
      }

      await logPayoutTraffic({ payout_id: payout?.id ?? null, direction: 'incoming', endpoint: '/api/payments/b2c-result', status_code: 200, payload: req.body, error: resultCode === 0 ? null : resultDesc });
    } catch (e: any) {
      console.error('Failed to process B2C result', e?.message || e);
    }
    return res.json({ ResultCode: 0, ResultDesc: 'Success' });
  });

  app.post('/api/payments/b2c-timeout', requireSafaricomIpAllowlist, async (req: Request, res: Response) => {
    try {
      const conversationId = req.body?.OriginatorConversationID ?? req.body?.ConversationID ?? null;
      const { data: payout } = await supabase.from('payouts').select('id').eq('initiator_message_id', conversationId).maybeSingle();
      if (payout?.id) {
        await supabase.from('payouts').update({ status: 'failed', failure_reason: 'M-Pesa queue timeout', processed_at: new Date().toISOString() }).eq('id', payout.id);
      }
      await logPayoutTraffic({ payout_id: payout?.id ?? null, direction: 'incoming', endpoint: '/api/payments/b2c-timeout', status_code: 200, payload: req.body, error: 'M-Pesa queue timeout' });
    } catch (e: any) {
      console.error('Failed to process B2C timeout', e?.message || e);
    }
    return res.json({ ResultCode: 0, ResultDesc: 'Success' });
  });
}
