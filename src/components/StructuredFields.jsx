import { useEffect, useId, useMemo, useRef } from 'react';
import { MEASUREMENTS, measurementState, washroomState, ventilationState, VENTILATION_TYPES, toggleVentilation } from '../utils/formFields';
import { PHONE_COUNTRIES, phoneState, normalizePhoneInput } from '../utils/phone';
import './StructuredFields.css';


function FieldGroup({ label, required, error, hint, children, descriptionId }) {
  const generatedId = useId();
  const id = descriptionId || generatedId;
  return (
    <fieldset className="form-field structured-field" aria-describedby={error || hint ? id : undefined}>
      <legend className="form-label">{label}{required && <span className="form-required"> *</span>}</legend>
      {children}
      {error ? <p id={id} className="form-error" role="alert">{error}</p>
        : hint ? <p id={id} className="structured-hint">{hint}</p> : null}
    </fieldset>
  );
}

function ExistingValue({ value, field, onReplace }) {
  return <div className="structured-existing">
    <p><span>Existing value</span><strong>{value}</strong></p>
    <button type="button" className="form-btn form-btn--ghost" data-field={field} onClick={onReplace}>Replace value</button>
  </div>;
}

export function MeasurementField({ field, value, onChange, error }) {
  const descriptionId = useId();
  const config = MEASUREMENTS[field];
  const state = measurementState(value, field);
  const labels = config.parts || ['Value'];
  // Allow unfinished decimals while typing; complete-value checks still run on save.
  const invalidParts = state.parts.map(part => state.edited && !/^\d*\.?\d*$/.test(part.trim()));
  const inputError = invalidParts.some(Boolean)
    ? 'Use digits and at most one decimal point (e.g. 50.5).' : null;
  const displayedError = inputError || error;
  const update = patch => onChange({ ...state, ...patch, edited: true, legacy: false });
  return <FieldGroup label={config.label} error={displayedError} hint={config.hint} descriptionId={descriptionId}>
    {state.legacy ? <ExistingValue value={state.edited ? `${state.parts.join(' x ')} ${state.unit}`.trim() : state.raw} field={field}
      onReplace={() => update({ parts: labels.map(() => ''), unit: config.units[0] })} /> : (
      <div className={`measurement-inputs${config.parts ? ' measurement-inputs--dimensions' : ''}`} data-parts={config.parts?.length}>
        {labels.map((label, index) => <label key={label} className="structured-part">
          {config.parts && <span>{label}</span>}
          <input className="form-input" type="text" inputMode="decimal" autoComplete="off"
            aria-label={`${config.label} ${label.toLowerCase()}`} aria-invalid={invalidParts[index] || Boolean(error)}
            aria-describedby={displayedError || config.hint ? descriptionId : undefined}
            data-field={index === 0 ? field : `${field}-${index}`} value={state.parts[index]}
            placeholder={config.parts ? label : 'Enter number'}
            onChange={event => update({ parts: state.parts.map((part, i) => i === index ? event.target.value : part) })} />
        </label>)}
        <label className="structured-part structured-unit">
          {config.parts && <span>Unit</span>}
          {config.units.length === 1 && state.unit === config.units[0] ? <span className="measurement-suffix">{config.units[0]}</span>
            : <select className="form-input" aria-label={`${config.label} unit`} value={state.unit}
              onChange={event => update({ unit: event.target.value })}>
              <option value="" disabled>Select unit</option>
              {config.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>}
        </label>
      </div>
    )}
    {state.edited && state.raw && <button type="button" className="structured-restore"
      onClick={() => onChange(measurementState(state.raw, field))}>Keep original value</button>}
  </FieldGroup>;
}

export function PhoneField({ field, label, value, onChange, error, required }) {
  const state = phoneState(value);
  const countryOptions = useMemo(() => PHONE_COUNTRIES.map(({ country, code, name }) =>
    <option key={country} value={country}>{country === state.country ? `${country} +${code}` : `${name} (+${code})`}</option>), [state.country]);
  return <FieldGroup label={label} required={required} error={error}>
    <div className="phone-inputs">
      <label className="structured-part">
        <select className="form-input" aria-label={`${label} country code`} value={state.country}
          onChange={event => onChange({ ...state, country: event.target.value, edited: true })}>
          {state.country.startsWith('+') && <option value={state.country}>{state.country} (international)</option>}
          {countryOptions}
        </select>
      </label>
      <label className="structured-part">
        <input className="form-input" type="tel" inputMode="tel" autoComplete="tel-national"
          aria-label={label} aria-invalid={Boolean(error)} data-field={field} value={state.national}
          placeholder="Phone number" onChange={event => onChange({ ...state, national: event.target.value, edited: true })}
          onBlur={() => { if (state.edited) onChange(normalizePhoneInput(state)); }}
          onPaste={event => {
            const text = event.clipboardData.getData('text').trim();
            if (/^(\+|00)/.test(text)) {
              event.preventDefault();
              onChange(normalizePhoneInput({ ...state, national: text, edited: true }));
            }
          }} />
      </label>
    </div>
  </FieldGroup>;
}

export function WashroomField({ value, onChange, error }) {
  const state = washroomState(value);
  return <FieldGroup label="Washroom Count" error={error} hint="Leave an unknown count blank. Enter 0 only if there are none.">
    {state.legacy ? <ExistingValue value={state.raw} field="washroom_count"
      onReplace={() => onChange({ ...state, legacy: false, edited: true })} />
      : <div className="washroom-inputs">{['male', 'female'].map((key, i) => <label key={key} className="structured-part">
        <span>{key === 'male' ? 'Male' : 'Female'}</span>
        <input className="form-input" aria-label={`${key === 'male' ? 'Male' : 'Female'} washrooms`}
          data-field={i === 0 ? 'washroom_count' : 'femaleWashrooms'} aria-invalid={Boolean(error)}
          type="text" inputMode="numeric" value={state[key]} placeholder="Count"
          onChange={event => onChange({ ...state, [key]: event.target.value, edited: true })} />
      </label>)}</div>}
    {state.edited && state.raw && <button type="button" className="structured-restore"
      onClick={() => onChange(washroomState(state.raw))}>Keep original value</button>}
  </FieldGroup>;
}

export function VentilationField({ value, onChange }) {
  const state = ventilationState(value);
  const dropdown = useRef(null);
  useEffect(() => {
    const closeOutside = event => {
      if (dropdown.current && !dropdown.current.contains(event.target)) dropdown.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  return <FieldGroup label="Ventilation Type" hint="Select all that apply.">
    {state.legacy ? <ExistingValue value={state.raw} field="ventilationType"
      onReplace={() => onChange({ ...state, choices: [], edited: true, legacy: false })} />
      : <details className="ventilation-select" ref={dropdown} onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.preventDefault();
          dropdown.current.open = false;
          dropdown.current.querySelector('summary').focus();
        }
      }}>
        <summary className="form-input" aria-label="Ventilation Type options">
          <span>{state.choices.length ? state.choices.join(', ') : 'Select ventilation types'}</span>
        </summary>
        <div className="ventilation-options">{VENTILATION_TYPES.map(option => <label key={option}
        className={`ventilation-option${state.choices.includes(option) ? ' is-selected' : ''}`}>
        <input type="checkbox" checked={state.choices.includes(option)} onChange={() => onChange(toggleVentilation(state, option))} />
        <span>{option}</span>
      </label>)}</div>
      </details>}
    {state.edited && state.raw && <button type="button" className="structured-restore"
      onClick={() => onChange(ventilationState(state.raw))}>Keep original value</button>}
  </FieldGroup>;
}
