import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';

const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const PHONE_COUNTRIES = getCountries().map(country => ({
  country, code: getCountryCallingCode(country), name: names.of(country),
})).sort((a, b) => a.country === 'IN' ? -1 : b.country === 'IN' ? 1 : a.name.localeCompare(b.name));

export function parsePhone(raw, country = 'IN') {
  const text = String(raw ?? '').trim();
  if (!text || !/^\+?[\d\s().-]+$/.test(text)) return undefined;
  const input = text.startsWith('00') ? `+${text.slice(2)}` : text;
  try {
    return parsePhoneNumberFromString(input, country.startsWith('+')
      ? { defaultCallingCode: country.slice(1), extract: false }
      : { defaultCountry: country, extract: false });
  } catch { return undefined; }
}

// Country-specific length checks accept mobiles and landlines without claiming
// that a number exists or rejecting newly allocated number ranges.
export const looksLikePhone = (raw, country = 'IN') => !raw || Boolean(parsePhone(raw, country)?.isPossible());

export function phoneState(value) {
  if (value?.kind === 'phone' && typeof value.national === 'string'
    && (PHONE_COUNTRIES.some(c => c.country === value.country) || /^\+\d{1,3}$/.test(value.country))) return value;
  const raw = String(value ?? '');
  const parsed = parsePhone(raw);
  return { kind: 'phone', raw, country: parsed?.country || (parsed ? `+${parsed.countryCallingCode}` : 'IN'),
    national: parsed?.nationalNumber || raw, edited: false };
}

export function phoneError(value, { required = false, allowLegacy = false } = {}) {
  const state = phoneState(value);
  if (!state.national.trim()) return required ? 'Contact number is required' : null;
  if (allowLegacy && !state.edited) return null;
  return parsePhone(state.national, state.country)?.isPossible() ? null : 'Enter a valid phone number for the selected country.';
}

export function serializePhone(value, preserveOriginal = false) {
  const state = phoneState(value);
  if (preserveOriginal && !state.edited) return state.raw || null;
  if (!state.national.trim()) return null;
  const parsed = parsePhone(state.national, state.country);
  if (!parsed?.isPossible()) throw new Error('Enter a valid phone number for the selected country.');
  return parsed.number;
}

export function normalizePhoneInput(value) {
  const parsed = parsePhone(value.national, value.country);
  return parsed?.isPossible() ? { ...value, country: parsed.country || `+${parsed.countryCallingCode}`, national: parsed.nationalNumber } : value;
}
