import { describe, expect, it } from 'vitest';
import { MEASUREMENTS, measurementState, measurementError, serializeMeasurement, hydrateMeasurements,
  serializeMeasurements, washroomState, washroomError, serializeWashrooms, ventilationState, toggleVentilation, serializeVentilation } from './formFields';
import { phoneState, phoneError, serializePhone, normalizePhoneInput, PHONE_COUNTRIES } from './phone';

describe('measurement contract', () => {
  it.each(Object.entries(MEASUREMENTS))('%s sends only a combined string', (key, config) => {
    for (const unit of config.units) {
      const state = { ...measurementState('', key), parts: (config.parts || ['Value']).map(() => '50.50'), unit, edited: true };
      expect(measurementError(state, key)).toBeNull();
      const value = `${state.parts.map(() => '50.5').join(' x ')} ${unit}`;
      expect(serializeMeasurement(state, key)).toBe(value);
      expect(measurementState(value, key)).toMatchObject({ parts: state.parts.map(() => '50.5'), unit, legacy: false });
    }
  });
  it.each(['50', '50 ft', '50 feet', '30–40 ft', 'Unknown', '5m on all sides'])('preserves untouched %s exactly', value => {
    expect(serializeMeasurement(measurementState(value, 'clearHeightFt'), 'clearHeightFt')).toBe(value);
  });
  it('parses explicit aliases and grouped numbers without guessing an ambiguous missing unit', () => {
    expect(measurementState('25,000 sft', 'builtup_area')).toMatchObject({ parts: ['25000'], unit: 'sq ft' });
    expect(measurementState('50', 'builtup_area').unit).toBe('');
    expect(measurementState('1,5 m', 'approachRoadWidth').legacy).toBe(true);
    expect(measurementState('8 × 10 ft', 'dockDimension')).toMatchObject({ parts: ['8', '10'], unit: 'feet' });
  });
  it.each(['land_parcel_size', 'builtup_area', 'carpet_area'])('preserves retired square-metre values and drafts for %s', key => {
    for (const raw of ['120 sq m', '120 sqm', '120 m²']) {
      const state = measurementState(raw, key);
      expect(state.legacy).toBe(true);
      expect(serializeMeasurement(state, key)).toBe(raw);
    }
    const draft = { kind: 'measurement', raw: '', parts: ['120.5'], unit: 'sq m', edited: true, legacy: false };
    const restored = measurementState(draft, key);
    expect(restored).toMatchObject({ parts: ['120.5'], unit: 'sq m', legacy: true });
    expect(serializeMeasurement(restored, key)).toBe('120.5 sq m');
    expect(measurementError({ ...draft, parts: ['120x'] }, key)).toBeTruthy();
  });
  it('distinguishes zero from blank and rejects malformed or partial input', () => {
    const state = { ...measurementState('', 'distance_from_highway'), edited: true };
    expect(serializeMeasurement(state, 'distance_from_highway')).toBeNull();
    expect(serializeMeasurement({ ...state, parts: ['0'] }, 'distance_from_highway')).toBe('0 km');
    for (const value of ['-1', '1e5', 'NaN', 'Infinity', '3 feet', '1.2.3']) {
      expect(measurementError({ ...state, parts: [value] }, 'distance_from_highway')).toBeTruthy();
    }
    expect(measurementError({ ...measurementState('', 'dimensions'), parts: ['20', '', '10'], edited: true }, 'dimensions')).toMatch(/every dimension/);
    expect(measurementError({ ...measurementState('', 'clearHeightFt'), parts: ['0'], edited: true }, 'clearHeightFt')).toBeTruthy();
  });
  it('retains structured drafts and unrelated media and setback values', () => {
    const old = { clearHeightFt: '20-30 ft', setbackArea: '5m on all sides', media: { images: ['photo'] }, _voiceDraftId: 'voice' };
    const hydrated = hydrateMeasurements(old);
    expect(hydrateMeasurements(JSON.parse(JSON.stringify(hydrated)))).toEqual(hydrated);
    expect(serializeMeasurements(hydrated)).toMatchObject(old);
  });
});

describe('washrooms and ventilation', () => {
  it('preserves old totals and only serializes the counts actually supplied', () => {
    expect(washroomState('5').legacy).toBe(true);
    expect(serializeWashrooms(washroomState('5'))).toBe('5');
    const state = { ...washroomState(''), edited: true, male: '0', female: '' };
    expect(serializeWashrooms(state)).toBe('Male: 0');
    expect(serializeWashrooms({ ...state, female: '3' })).toBe('Male: 0; Female: 3');
    expect(washroomState('Male: 0; Female: 3')).toMatchObject({ male: '0', female: '3', legacy: false });
    for (const male of ['-1', '1.5', '1e2']) expect(washroomError({ ...state, male })).toBeTruthy();
  });
  it('keeps unknown ventilation and handles mutually exclusive choices', () => {
    expect(serializeVentilation(ventilationState('Special roof vents'))).toBe('Special roof vents');
    let state = toggleVentilation(ventilationState(''), 'Turbo');
    state = toggleVentilation(state, 'Ridge');
    expect(serializeVentilation(state)).toBe('Ridge, Turbo');
    state = toggleVentilation(state, 'None');
    expect(state.choices).toEqual(['None']);
    state = toggleVentilation(state, 'Not Known');
    expect(state.choices).toEqual(['Not Known']);
    state = toggleVentilation(state, 'Window');
    expect(state.choices).toEqual(['Window']);
  });
});

describe('international contact contract', () => {
  it.each([['+1 202 555 0123', '+12025550123'], ['+44 20 7946 0123', '+442079460123'],
    ['+91 98765 43210', '+919876543210'], ['080 2345 6789', '+918023456789'], ['+61 2 9374 4000', '+61293744000']])(
    'splits and recombines %s', (raw, expected) => {
      const state = phoneState(raw);
      expect(phoneError(state)).toBeNull();
      expect(serializePhone(state)).toBe(expected);
      expect(serializePhone(state, true)).toBe(raw);
    });
  it('supports country changes, international paste, invalid input, optional blanks and old edit values', () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(200);
    const state = { ...phoneState(''), edited: true, country: 'GB', national: '02079460123' };
    expect(serializePhone(state)).toBe('+442079460123');
    expect(normalizePhoneInput({ ...state, national: '+1 (202) 555-0123' })).toMatchObject({ country: 'US', national: '2025550123' });
    expect(phoneError(phoneState(''))).toBeNull();
    expect(phoneError(phoneState(''), { required: true })).toBeTruthy();
    expect(phoneError({ ...state, national: 'call 02079460123' })).toBeTruthy();
    expect(phoneError(phoneState('old text'), { allowLegacy: true })).toBeNull();
    expect(phoneError(phoneState('old text'))).toBeTruthy();
  });
});

it('requires the primary contact even when an older record has no number', () => {
  expect(phoneError(phoneState(''), { required: true, allowLegacy: true })).toBe('Contact number is required');
});
