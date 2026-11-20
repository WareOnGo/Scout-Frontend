const LENGTH = ['feet', 'metres'];
export const MEASUREMENTS = {
  distance_from_highway: { label: 'Distance from Highway', units: ['km', 'metres'], zero: true, step: 1 },
  approachRoadWidth: { label: 'Approach Road Width', units: LENGTH, bareUnit: 'feet', step: 1 },
  land_parcel_size: { label: 'Land Parcel Size', units: ['acres', 'hectares', 'sq ft'], legacyUnits: ['sq m'] },
  builtup_area: { label: 'Built-up Area', units: ['sq ft'], legacyUnits: ['sq m'] },
  carpet_area: { label: 'Carpet Area', units: ['sq ft'], legacyUnits: ['sq m'], zero: true },
  dimensions: { label: 'Dimensions', units: LENGTH, parts: ['Length', 'Width', 'Height'] },
  clearHeightFt: { label: 'Clear Height', units: LENGTH, bareUnit: 'feet', hint: 'Side height of the warehouse.' },
  centreHeight: { label: 'Centre Height', units: LENGTH },
  plinthHeightFt: { label: 'Plinth Height', units: LENGTH, bareUnit: 'feet', zero: true },
  dockDimension: { label: 'Dock Dimension', units: LENGTH, bareUnit: 'feet', parts: ['Width', 'Height'] },
  dockApronLengthFt: { label: 'Dock Apron Length', units: LENGTH, bareUnit: 'feet' },
  gateSizeFt: { label: 'Compound Gate Width', units: LENGTH, bareUnit: 'feet' },
  floorStrengthPerSqm: { label: 'Floor Strength', units: ['tonnes/sq m'], bareUnit: 'tonnes/sq m' },
  lightingDetails: { label: 'Lighting', units: ['lux'], bareUnit: 'lux', zero: true },
  powerKva: { label: 'Power', units: ['kVA', 'HP'], bareUnit: 'kVA', zero: true },
};
export const LAND_TYPES = ['Warehouse CLU', 'Commercial CLU', 'Industrial CLU', 'Agricultural CLU', 'Residential CLU', 'Others'];
export const CANOPY_TYPES = ['Running', 'Shutter', 'None'];
export const DOCK_PLATFORM_TYPES = ['None', 'Extended', 'Running', 'Angled/Cross', 'Inward'];
export const FLOORING_TYPES = ['Tiles', 'Conventional Concrete', 'VDF', 'FM2', 'Kota Stone', 'Others', 'Not Known'];
export const VENTILATION_TYPES = ['Ridge', 'Turbo', 'Side Louvres', 'Window', 'None', 'Not Known'];

const aliases = {
  feet: ['feet', 'foot', 'ft', 'ft.', "'"], metres: ['metres', 'meters', 'metre', 'meter', 'mtr', 'mtrs', 'm'],
  km: ['km', 'kms', 'kilometres', 'kilometers'], acres: ['acres', 'acre'], hectares: ['hectares', 'hectare', 'ha'],
  'sq ft': ['sq ft', 'sq. ft.', 'sqft', 'sft', 'ft2', 'ft²', 'square feet'],
  'sq m': ['sq m', 'sq. m.', 'sqm', 'smt', 'm2', 'm²', 'square metres', 'square meters'],
  'tonnes/sq m': ['tonnes/sq m', 'tonnes per sqm', 'tonnes/sqm', 't/sqm', 't/m2', 't/m²'],
  lux: ['lux', 'lx'], kVA: ['kva'], HP: ['hp'],
};
const numeric = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const cleanNumber = v => String(v).trim().replace(/^0+(?=\d)/, '').replace(/^(\.)/, '0$1').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
const rawString = value => value == null ? '' : String(value);
const isPowerRequirement = value => /^as\s+per\s+requirement$/i.test(rawString(value).trim());

export function measurementState(value, key) {
  const config = MEASUREMENTS[key];
  const count = config.parts?.length || 1;
  if (value?.kind === 'measurement' && Array.isArray(value.parts) && value.parts.length === count
    && value.parts.every(part => typeof part === 'string') && typeof value.unit === 'string') {
    if (key === 'powerKva' && !value.edited && value.asPerRequirement == null && isPowerRequirement(value.raw)) {
      return { ...value, asPerRequirement: true, legacy: false };
    }
    // Retired units stay readable in saved drafts without relabelling the number.
    return config.legacyUnits?.includes(value.unit) ? { ...value, legacy: true } : value;
  }
  const raw = rawString(value);
  const state = { kind: 'measurement', raw, parts: Array(count).fill(''), unit: config.units[0], edited: false, legacy: false };
  if (!raw.trim()) return state;
  if (key === 'powerKva' && isPowerRequirement(raw)) return { ...state, asPerRequirement: true };
  let numberText = raw.trim();
  let unit = '';
  for (const candidate of [...config.units, ...(config.legacyUnits || [])]) {
    const alias = aliases[candidate].find(a => numberText.toLowerCase().endsWith(a));
    if (alias) { unit = candidate; numberText = numberText.slice(0, -alias.length).trim(); break; }
  }
  const parts = numberText.split(/\s*[x×]\s*/i);
  // Only strip valid digit grouping; never turn a decimal comma into a different number.
  const parsed = parts.map(part => /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(part) ? part.replace(/,/g, '') : part);
  if (parsed.length !== count || parsed.some(part => !numeric.test(part))) return { ...state, legacy: true };
  return { ...state, parts: parsed, unit: unit || config.bareUnit || '', legacy: Boolean(config.legacyUnits?.includes(unit)) };
}

export function measurementError(value, key) {
  const state = measurementState(value, key);
  if (key === 'powerKva' && state.asPerRequirement === true) return null;
  if (!state.edited && state.raw.trim()) return null;
  const config = MEASUREMENTS[key];
  if (state.parts.every(part => !part.trim())) return null;
  if (state.parts.some(part => !part.trim())) return 'Complete every dimension or clear them all.';
  if (state.parts.some(part => !numeric.test(part.trim()) || !Number.isFinite(Number(part))
    || (config.zero ? Number(part) < 0 : Number(part) <= 0))) {
    return config.zero ? 'Enter a number of zero or more.' : 'Enter a number greater than zero.';
  }
  if (!config.units.includes(state.unit) && !config.legacyUnits?.includes(state.unit)) return 'Select a unit.';
  return null;
}

export function serializeMeasurement(value, key) {
  const state = measurementState(value, key);
  if (key === 'powerKva' && state.asPerRequirement === true) {
    return !state.edited && isPowerRequirement(state.raw) ? state.raw : 'As per requirement';
  }
  if (!state.edited) return state.raw || null;
  const error = measurementError(state, key);
  if (error) throw new Error(`${MEASUREMENTS[key].label}: ${error}`);
  return state.parts.every(part => !part.trim()) ? null : `${state.parts.map(cleanNumber).join(' x ')} ${state.unit}`;
}

export function setPowerRequirement(value, checked) {
  const state = measurementState(value, 'powerKva');
  // Preserve the current number/unit (or legacy text) when toggling temporarily.
  // Unticking an existing requirement value clears it rather than resaving its raw text.
  return { ...state, asPerRequirement: checked, edited: state.edited || (!checked && isPowerRequirement(state.raw)) };
}

export function washroomState(value) {
  if (value?.kind === 'washrooms' && typeof value.male === 'string' && typeof value.female === 'string') return value;
  const raw = rawString(value);
  const state = { kind: 'washrooms', raw, male: '', female: '', edited: false, legacy: false };
  if (!raw.trim()) return state;
  const seen = new Set();
  for (const part of raw.split(';')) {
    const match = part.trim().match(/^(Male|Female):\s*(\d+)$/i);
    if (!match || seen.has(match[1].toLowerCase())) return { ...state, male: '', female: '', legacy: true };
    const key = match[1].toLowerCase();
    seen.add(key);
    state[key] = match[2];
  }
  return state;
}
export function washroomError(value) {
  const state = washroomState(value);
  if (!state.edited) return null;
  return [state.male, state.female].some(v => v !== '' && (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))))
    ? 'Enter whole numbers of zero or more.' : null;
}
export function serializeWashrooms(value) {
  const state = washroomState(value);
  if (!state.edited) return state.raw || null;
  if (washroomError(state)) throw new Error(washroomError(state));
  return [['Male', state.male], ['Female', state.female]].filter(([, count]) => count !== '')
    .map(([label, count]) => `${label}: ${Number(count)}`).join('; ') || null;
}

export function ventilationState(value) {
  if (value?.kind === 'ventilation' && Array.isArray(value.choices)) return value;
  const raw = rawString(value);
  const choices = raw.split(/[,/]/).map(part => part.trim()).filter(Boolean).map(part => {
    if (/^side louv(?:re|er)s?$/i.test(part)) return 'Side Louvres';
    if (/^windows?$/i.test(part)) return 'Window';
    return VENTILATION_TYPES.find(option => option.toLowerCase() === part.toLowerCase());
  });
  return { kind: 'ventilation', raw, choices: [...new Set(choices.filter(Boolean))], edited: false,
    legacy: choices.includes(undefined) || choices.length > 1 && choices.some(v => ['None', 'Not Known'].includes(v)) };
}
export function toggleVentilation(value, choice) {
  const state = ventilationState(value);
  const choices = state.legacy ? [] : state.choices;
  const selected = choices.includes(choice) ? choices.filter(v => v !== choice)
    : ['None', 'Not Known'].includes(choice) ? [choice]
      : [...choices.filter(v => !['None', 'Not Known'].includes(v)), choice];
  return { ...state, choices: selected, legacy: false, edited: true };
}
export function serializeVentilation(value) {
  const state = ventilationState(value);
  return state.edited ? VENTILATION_TYPES.filter(v => state.choices.includes(v)).join(', ') || null : state.raw || null;
}

export function hydrateMeasurements(values) {
  const result = { ...values };
  for (const key of Object.keys(MEASUREMENTS)) result[key] = measurementState(values[key], key);
  result.washroom_count = washroomState(values.washroom_count);
  result.ventilationType = ventilationState(values.ventilationType);
  return result;
}
export function serializeMeasurements(values) {
  const result = { ...values };
  for (const key of Object.keys(MEASUREMENTS)) result[key] = serializeMeasurement(values[key], key);
  result.washroom_count = serializeWashrooms(values.washroom_count);
  result.ventilationType = serializeVentilation(values.ventilationType);
  return result;
}
