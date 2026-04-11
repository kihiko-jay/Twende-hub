import type { Request, Response, NextFunction } from 'express';
import config from '../config.js';

export const SAFARICOM_CALLBACK_IPS = new Set([
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
]);

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const candidate = forwarded || req.socket?.remoteAddress || '';
  return String(candidate).replace(/^::ffff:/, '');
}

export function requireSafaricomIpAllowlist(req: Request, res: Response, next: NextFunction) {
  if (!config.isProd) return next();
  const ip = extractClientIp(req);
  if (!SAFARICOM_CALLBACK_IPS.has(ip)) {
    console.warn('Blocked non-Safaricom callback IP:', ip);
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

export function normalizeKenyanPhone(input: string): string {
  const value = input.replace(/\s+/g, '');
  if (value.startsWith('+254')) return value.slice(1);
  if (value.startsWith('254')) return value;
  if (value.startsWith('0')) return `254${value.slice(1)}`;
  return value;
}

export function isValidKenyanPhone(input: string): boolean {
  const normalized = input.replace(/\s+/g, '');
  return /^(?:\+?254|0)(?:7\d{8}|1\d{8})$/.test(normalized);
}

export function getManualReviewType(value: unknown): 'creation' | 'feature' | 'participant' {
  if (value === 'feature' || value === 'participant') return value;
  return 'creation';
}
