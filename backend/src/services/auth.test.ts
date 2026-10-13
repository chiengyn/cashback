import { describe, expect, it } from 'vitest';

import { normalizePhone } from './auth';

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '0912345678'],
    ['+84 912 345 678', '0912345678'],
    ['84912345678', '0912345678'],
    ['091.234.5678', '0912345678'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('từ chối số không phải di động VN', () => {
    expect(normalizePhone('0212345678')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
  });
});
