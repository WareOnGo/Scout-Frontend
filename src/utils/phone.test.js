import { describe, it, expect } from 'vitest';
import { looksLikePhone, phoneState, phoneError, serializePhone, normalizePhoneInput } from './phone';

describe('looksLikePhone — soft phone-number validation', () => {
  it.each([
    '9876543210',          // plain 10-digit mobile
    '98765 43210',         // mobile with whitespace
    '987 654 3210',        // mobile with multiple spaces
    '+91 98765 43210',     // +91 prefix with whitespace
    '+919876543210',       // +91 prefix, no spaces
    '919876543210',        // 91 prefix, no plus
    '098765 43210',        // leading 0 trunk prefix
    '080 2345 6789',       // landline with STD code
    '022-2345-6789',       // landline with dashes
    '(080) 23456789',      // landline with parens
    '  9876543210  ',      // surrounding whitespace
    '',                    // empty — handled by required-field check
    null,                  // nullish input is tolerated
    undefined,
  ])('accepts %p', (val) => {
    expect(looksLikePhone(val)).toBe(true);
  });

  it.each([
    'abcdefghij',          // letters
    '98765',               // too short
    '123',                 // way too short
    '9876543210123456',    // far too long
    'call me maybe',       // free text
    '98765abcde',          // mixed digits + letters
    '!!!!!!!!!!',          // punctuation only
  ])('flags %p as suspicious', (val) => {
    expect(looksLikePhone(val)).toBe(false);
  });
});

describe('copied phone numbers', () => {
  it.each([
    '9980088303',
    '\u200e9980088303\u200f',
    '99800\u200b8\u200c8\u200d303',
    '\u202a9980088303\u202c',
    '\u2066+91 99800 88303\u2069',
    '+91\u00a099800\u202f88303',
    '\u061c00 91 99800\u206088303\ufeff',
    '99800\u00ad88303',
  ])('accepts copied formatting in %j without changing the number', raw => {
    const state = { ...phoneState(''), country: 'IN', national: raw, edited: true };
    expect(looksLikePhone(raw)).toBe(true);
    expect(phoneError(state, { required: true })).toBeNull();
    expect(serializePhone(state)).toBe('+919980088303');
    expect(normalizePhoneInput(state)).toMatchObject({ country: 'IN', national: '9980088303' });
    expect(phoneState(raw)).toMatchObject({ country: 'IN', national: '9980088303' });
  });

  it.each(['\u200e99800abcde', '\u200e99800', '\u2066+91 9980088303999999\u2069'])(
    'still rejects invalid numbers after removing formatting from %j', raw => {
      const state = { ...phoneState(''), national: raw, edited: true };
      expect(looksLikePhone(raw)).toBe(false);
      expect(phoneError(state)).toBeTruthy();
      expect(() => serializePhone(state)).toThrow('Enter a valid phone number');
    },
  );

  it('treats formatting-only input as empty, including restored drafts', () => {
    const state = { ...phoneState(''), national: '\u200e\u200b\u2060\u00a0', edited: true };
    expect(phoneError(state, { required: true })).toBe('Contact number is required');
    expect(phoneError(state)).toBeNull();
    expect(serializePhone(state)).toBeNull();
  });

  it('preserves an untouched stored value when requested', () => {
    const raw = '\u200e+91 99800 88303';
    expect(serializePhone(phoneState(raw), true)).toBe(raw);
  });
});
