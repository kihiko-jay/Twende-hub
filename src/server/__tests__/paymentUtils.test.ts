import { describe, expect, it } from 'vitest';
import { getManualReviewType, isValidKenyanPhone, normalizeKenyanPhone } from '../paymentUtils';

describe('payment utils', () => {
  it('accepts Kenyan 07, 01 and +254 formats', () => {
    expect(isValidKenyanPhone('0712345678')).toBe(true);
    expect(isValidKenyanPhone('0112345678')).toBe(true);
    expect(isValidKenyanPhone('+254712345678')).toBe(true);
    expect(isValidKenyanPhone('+254112345678')).toBe(true);
    expect(isValidKenyanPhone('12345')).toBe(false);
  });

  it('normalizes Kenyan phone numbers to 254 format', () => {
    expect(normalizeKenyanPhone('0712345678')).toBe('254712345678');
    expect(normalizeKenyanPhone('+254712345678')).toBe('254712345678');
  });

  it('falls back to creation for unknown manual review types', () => {
    expect(getManualReviewType('participant')).toBe('participant');
    expect(getManualReviewType('weird')).toBe('creation');
  });
});
