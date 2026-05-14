import { useState, useEffect, useCallback } from 'react';
import FileUpload from './FileUpload';
import './WarehouseForm.css';
import { clearErrors } from '../utils/errorHandler';
import { useViewport } from '../hooks/useViewport';
import { getMediaFromWarehouse } from '../utils/mediaUtils';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const ZONES = ['North', 'South', 'East', 'West', 'Central'];
const LAND_TYPES = ['Warehouse CLU', 'Commercial CLU', 'Industrial CLU', 'Others'];
const POLLUTION_ZONES = ['Green', 'Yellow', 'Red'];
const formSteps = [
  { title: 'Owner Details', fields: ['listing_type', 'contactPerson', 'contactNumber', 'uploadedBy'] },
  { title: 'Location Details', fields: ['address', 'city', 'state', 'zone'] },
  { title: 'Technical Specs', fields: ['warehouseType', 'totalSpaceSqft'] },
  { title: 'Compliances', fields: ['compliances'] },
  { title: 'Commercials', fields: ['ratePerSqft'] },
  { title: 'Media', fields: [] },
];

const INITIAL_VALUES = {
  warehouseOwnerType: '', warehouseType: '', zone: '', address: '',
  city: '', state: '', postalCode: '', googleLocation: '',
  contactPerson: '', contactNumber: '',
  totalSpaceSqft: [1000], ratePerSqft: '', offeredSpaceSqft: '', numberOfDocks: '',
  clearHeightFt: '', availability: '', isBroker: '', uploadedBy: '',
  compliances: '', otherSpecifications: '',
  fireNocAvailable: false,
  fireSafetyMeasures: '', landType: '', approachRoadWidth: '',
  powerKva: '', pollutionZone: '', vaastuCompliance: false,
  parkingDockingSpace: '', photos: '', media: null,
  // Newly added fields
  listing_type: '',
  alt_phone_number: '', land_parcel_size: '', builtup_area: '',
  owner_warmnth: '', distance_from_highway: '', is_builder: false,
  owner_of_multiple_sites: '', carpet_area: '', nearest_transport: '',
  fire_exits: '', fire_compliance_cert_type: '',
  washroom_count: '',
  ownerCompanyName: '', ownerAltPoc: '',
  gateSizeFt: '', dockApronLengthFt: '', setbackArea: '', ccRoads: '',
  wallAndSecurityRoom: '', plinthHeightFt: '',
  dockDimension: '', canopyType: '', dockPlatformType: '', otherDockingSpecs: '',
  flooringType: '', floorStrengthPerSqm: '', ventilationType: '',
  insulationPresent: '', insulationType: '',
  lightingDetails: '', centreHeight: '',
};

/** Flatten initialData (including nested WarehouseData) into form shape */
const toFormValues = (d) => {
  if (!d) return { ...INITIAL_VALUES };
  const wd = d.WarehouseData || d.warehouseData || {};
  return {
    warehouseOwnerType: d.warehouseOwnerType || '',
    warehouseType: d.warehouseType || '',
    zone: d.zone || '',
    address: d.address || '',
    city: d.city || '',
    state: d.state || '',
    postalCode: d.postalCode || '',
    googleLocation: d.googleLocation || '',
    contactPerson: d.contactPerson || '',
    contactNumber: d.contactNumber || '',
    totalSpaceSqft: Array.isArray(d.totalSpaceSqft)
      ? d.totalSpaceSqft
      : d.totalSpaceSqft ? [d.totalSpaceSqft] : [1000],
    ratePerSqft: d.ratePerSqft ?? '',
    offeredSpaceSqft: d.offeredSpaceSqft ?? '',
    numberOfDocks: d.numberOfDocks ?? '',
    clearHeightFt: d.clearHeightFt ?? '',
    availability: d.availability || '',
    isBroker: d.isBroker || '',
    uploadedBy: d.uploadedBy || '',
    compliances: d.compliances || '',
    otherSpecifications: d.otherSpecifications || '',
    fireNocAvailable: wd.fireNocAvailable === true || wd.fireNocAvailable === 'true',
    fireSafetyMeasures: wd.fireSafetyMeasures || '',
    landType: wd.landType || '',
    approachRoadWidth: wd.approachRoadWidth ?? '',
    powerKva: wd.powerKva ?? '',
    pollutionZone: wd.pollutionZone || '',
    vaastuCompliance: wd.vaastuCompliance === true || wd.vaastuCompliance === 'true',
    parkingDockingSpace: wd.parkingDockingSpace || '',
    photos: d.photos || '',
    media: getMediaFromWarehouse(d),
    // Newly added fields
    listing_type: d.listing_type || '',
    alt_phone_number: d.alt_phone_number || '',
    land_parcel_size: d.land_parcel_size || '',
    builtup_area: d.builtup_area || '',
    owner_warmnth: d.owner_warmnth || '',
    distance_from_highway: d.distance_from_highway || '',
    is_builder: d.is_builder === true || d.is_builder === 'true',
    owner_of_multiple_sites: d.owner_of_multiple_sites || '',
    carpet_area: d.carpet_area || '',
    nearest_transport: d.nearest_transport || '',
    fire_exits: d.fire_exits || '',
    fire_compliance_cert_type: d.fire_compliance_cert_type || '',
    washroom_count: d.washroom_count || '',
    ownerCompanyName: d.ownerCompanyName || '',
    ownerAltPoc: d.ownerAltPoc || '',
    gateSizeFt: d.gateSizeFt || '',
    dockApronLengthFt: d.dockApronLengthFt || '',
    setbackArea: d.setbackArea || '',
    ccRoads: d.ccRoads || '',
    wallAndSecurityRoom: d.wallAndSecurityRoom || '',
    plinthHeightFt: d.plinthHeightFt || '',
    dockDimension: d.dockDimension || '',
    canopyType: d.canopyType || '',
    dockPlatformType: d.dockPlatformType || '',
    otherDockingSpecs: d.otherDockingSpecs || '',
    flooringType: d.flooringType || '',
    floorStrengthPerSqm: d.floorStrengthPerSqm || '',
    ventilationType: d.ventilationType || '',
    insulationPresent: d.insulationPresent || '',
    insulationType: d.insulationType || '',
    lightingDetails: d.lightingDetails || '',
    centreHeight: d.centreHeight || '',
  };
};

// ── Reusable UI (JSX + CSS, no component library) ─────────────────────────────

const FormSteps = ({ steps, current, isMobile }) => (
  <div className="form-steps-wrap">
    <div className="form-steps" role="list" aria-label="Form steps">
      {steps.map((s, i) => (
        <div
          key={s.title}
          role="listitem"
          className={
            'form-steps__item'
            + (i < current ? ' form-steps__item--complete' : '')
            + (i === current ? ' form-steps__item--current' : '')
            + (i > current ? ' form-steps__item--todo' : '')
          }
        >
          <span className="form-steps__badge" aria-current={i === current ? 'step' : undefined}>
            {i + 1}
          </span>
          {!isMobile && <span className="form-steps__title">{s.title}</span>}
        </div>
      ))}
    </div>
    {isMobile && <p className="form-steps__mobile-title">{steps[current]?.title}</p>}
  </div>
);

const FormSpinner = ({ tip, large }) => (
  <div className={large ? 'form-spinner form-spinner--lg' : 'form-spinner'}>
    <div className="form-spinner__arc" aria-hidden />
    {tip && <p className="form-spinner__tip">{tip}</p>}
  </div>
);

const HelpTip = ({ text }) => (
  <span className="form-help" tabIndex={0}>
    <span className="form-help__icon" aria-hidden>?</span>
    <span className="form-help__tip" role="tooltip">{text}</span>
  </span>
);

const Field = ({ label, required, error, children, style, tooltip }) => (
  <div className="form-field" style={style}>
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="form-required"> *</span>}
        {tooltip && <HelpTip text={tooltip} />}
      </label>
    )}
    {children}
    {error && <div className="form-error">{error}</div>}
  </div>
);

const TextInput = ({ value, onChange, mobile: _m, placeholder, type = 'text', inputMode, maxLength, autoComplete, ...rest }) => (
  <input
    className="form-input"
    type={type}
    inputMode={inputMode}
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    autoComplete={autoComplete || 'off'}
    {...rest}
  />
);

const TextAreaInput = ({ value, onChange, mobile: _m, placeholder, rows = 3 }) => (
  <textarea
    className="form-input"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
  />
);

const SelectInput = ({ value, onChange, mobile: _m, placeholder, options, ...rest }) => (
  <select
    className="form-input"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    {...rest}
  >
    <option value="" disabled>{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const ToggleSwitch = ({ checked, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <div className="form-toggle-split" role="group" aria-label="Toggle">
    <button
      type="button"
      className={`form-toggle-split__btn${!checked ? ' is-active' : ''}`}
      onClick={() => onChange(false)}
    >
      {noLabel}
    </button>
    <button
      type="button"
      className={`form-toggle-split__btn${checked ? ' is-active' : ''}`}
      onClick={() => onChange(true)}
    >
      {yesLabel}
    </button>
  </div>
);

const Section = ({ title, children }) => (
  <section>
    <h2 className="form-section__title">{title}</h2>
    {children}
  </section>
);

// ── Main component ────────────────────────────────────────────────────────────

const DRAFT_STORAGE_KEY = 'warehouseForm:draft:v1';

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.values) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveDraft = (values, currentStep) => {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ values, currentStep, savedAt: Date.now() })
    );
  } catch {
    // Quota exceeded or storage unavailable — drop the draft silently.
  }
};

const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
};

const WarehouseForm = ({ visible, onCancel, onSubmit, initialData = null, loading = false }) => {
  const { isMobile } = useViewport();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);

  // Reset form when modal opens
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [contactTouched, setContactTouched] = useState(false);
  useEffect(() => {
    if (visible) {
      // Only restore a draft when this is a brand-new form (no initialData edit context).
      const draft = !initialData ? loadDraft() : null;
      if (draft) {
        setValues({ ...INITIAL_VALUES, ...draft.values });
        setCurrentStep(Number.isInteger(draft.currentStep) ? draft.currentStep : 0);
        setDraftRestored(true);
      } else {
        setValues(toFormValues(initialData));
        setCurrentStep(0);
        setDraftRestored(false);
      }
      setErrors({});
      setInitialSnapshot(initialData);
      setContactTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Persist draft on change (debounced). Skip while editing an existing record.
  useEffect(() => {
    if (!visible || initialData) return;
    const t = setTimeout(() => saveDraft(values, currentStep), 400);
    return () => clearTimeout(t);
  }, [visible, initialData, values, currentStep]);

  // Patch in background-fetched contact number without resetting the form
  useEffect(() => {
    if (visible && !contactTouched && initialData && initialSnapshot &&
      initialData.id === initialSnapshot.id &&
      initialData.contactNumber !== initialSnapshot.contactNumber) {
      setValues(prev => ({ ...prev, contactNumber: initialData.contactNumber || prev.contactNumber }));
      setInitialSnapshot(initialData);
    }
  }, [visible, initialData, initialSnapshot, contactTouched]);

  const set = (field) => (val) => {
    setValues(prev => ({ ...prev, [field]: val }));
    if (field === 'contactNumber') setContactTouched(true);
    // Clear error on change
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep = (stepIndex) => {
    const e = {};
    const fields = formSteps[stepIndex].fields;
    if (fields.includes('listing_type') && !values.listing_type) e.listing_type = 'Listing type is required';
    if (fields.includes('warehouseType') && !values.warehouseType?.trim()) e.warehouseType = 'Warehouse type is required';
    if (fields.includes('zone') && !values.zone) e.zone = 'Zone is required';
    if (fields.includes('address') && !values.address?.trim()) e.address = 'Address is required';
    if (fields.includes('city') && !values.city?.trim()) e.city = 'City is required';
    if (fields.includes('state') && !values.state?.trim()) e.state = 'State is required';
    if (fields.includes('contactPerson') && !values.contactPerson?.trim()) e.contactPerson = 'Contact person is required';
    if (fields.includes('contactNumber') && !values.contactNumber?.trim()) e.contactNumber = 'Contact number is required';
    if (fields.includes('totalSpaceSqft')) {
      const spaces = (values.totalSpaceSqft || []).filter(v => v != null && v > 0);
      if (spaces.length === 0) e.totalSpaceSqft = 'At least one space value is required';
    }
    if (fields.includes('ratePerSqft') && !values.ratePerSqft && values.ratePerSqft !== 0) e.ratePerSqft = 'Rate per sq ft is required';
    if (fields.includes('uploadedBy') && !values.uploadedBy?.trim()) e.uploadedBy = 'Uploaded by is required';
    if (fields.includes('compliances') && !values.compliances) e.compliances = 'Compliance info is required';

    setErrors(prev => {
      const newErrors = { ...prev };
      fields.forEach(f => delete newErrors[f]);
      return { ...newErrors, ...e };
    });

    if (Object.keys(e).length > 0) {
      const firstKey = Object.keys(e)[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstKey}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Guard: only submit on the final step (Media). This prevents accidental
    // form submission when the user presses Enter on earlier steps, since all
    // steps are rendered in the DOM and the browser can find the submit button.
    if (currentStep !== formSteps.length - 1) return;
    if (!validateStep(currentStep)) return;
    if (mediaUploading) {
      setErrors(prev => ({ ...prev, _media: 'Please wait for media uploads to finish before submitting.' }));
      return;
    }

    setSubmitting(true);
    try {
      // Build media from form state (the FileUpload now manages a media object)
      const media = values.media || { images: [], videos: [], docs: [] };
      const hasMedia = (media.images?.length || 0) + (media.videos?.length || 0) + (media.docs?.length || 0) > 0;

      // Double-write: flatten media back to photos CSV for legacy column
      const allUrls = [...(media.images || []), ...(media.videos || []), ...(media.docs || [])];
      const photosValue = allUrls.length > 0 ? allUrls.join(',') : null;

      const payload = {
        warehouseOwnerType: values.warehouseOwnerType || null,
        warehouseType: values.warehouseType,
        address: values.address,
        googleLocation: values.googleLocation || null,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode || null,
        zone: values.zone,
        contactPerson: values.contactPerson,
        contactNumber: values.contactNumber,
        totalSpaceSqft: (values.totalSpaceSqft || []).filter(v => v != null && v > 0),
        offeredSpaceSqft: values.offeredSpaceSqft ? String(values.offeredSpaceSqft) : null,
        numberOfDocks: values.numberOfDocks ? String(values.numberOfDocks) : null,
        clearHeightFt: values.clearHeightFt ? String(values.clearHeightFt) : null,
        compliances: values.compliances,
        otherSpecifications: values.otherSpecifications || null,
        ratePerSqft: values.ratePerSqft ? String(values.ratePerSqft) : null,
        availability: values.availability || null,
        uploadedBy: values.uploadedBy,
        isBroker: values.isBroker || null,
        photos: photosValue,
        media: hasMedia ? media : null,
        // Newly added fields (all optional)
        listing_type: values.listing_type || null,
        alt_phone_number: values.alt_phone_number || null,
        land_parcel_size: values.land_parcel_size || null,
        builtup_area: values.builtup_area || null,
        owner_warmnth: values.owner_warmnth || null,
        distance_from_highway: values.distance_from_highway || null,
        is_builder: typeof values.is_builder === 'boolean' ? values.is_builder : null,
        owner_of_multiple_sites: values.owner_of_multiple_sites || null,
        carpet_area: values.carpet_area || null,
        nearest_transport: values.nearest_transport || null,
        fire_exits: values.fire_exits || null,
        fire_compliance_cert_type: values.fire_compliance_cert_type || null,
        washroom_count: values.washroom_count || null,
        ownerCompanyName: values.ownerCompanyName || null,
        ownerAltPoc: values.ownerAltPoc || null,
        gateSizeFt: values.gateSizeFt || null,
        dockApronLengthFt: values.dockApronLengthFt || null,
        setbackArea: values.setbackArea || null,
        ccRoads: values.ccRoads || null,
        wallAndSecurityRoom: values.wallAndSecurityRoom || null,
        plinthHeightFt: values.plinthHeightFt || null,
        dockDimension: values.dockDimension || null,
        canopyType: values.canopyType || null,
        dockPlatformType: values.dockPlatformType || null,
        otherDockingSpecs: values.otherDockingSpecs || null,
        flooringType: values.flooringType || null,
        floorStrengthPerSqm: values.floorStrengthPerSqm || null,
        ventilationType: values.ventilationType || null,
        insulationPresent: values.insulationPresent || null,
        insulationType: values.insulationType || null,
        lightingDetails: values.lightingDetails || null,
        centreHeight: values.centreHeight || null,
        warehouseData: {
          fireNocAvailable: Boolean(values.fireNocAvailable),
          fireSafetyMeasures: values.fireSafetyMeasures || null,
          landType: values.landType || null,
          approachRoadWidth: values.approachRoadWidth ? String(values.approachRoadWidth) : null,
          parkingDockingSpace: values.parkingDockingSpace || null,
          pollutionZone: values.pollutionZone || null,
          powerKva: values.powerKva ? String(values.powerKva) : null,
          vaastuCompliance: values.vaastuCompliance ? 'true' : null,
        },
      };

      await onSubmit(payload);
      clearDraft();
      setDraftRestored(false);
      setValues(INITIAL_VALUES);
      setCurrentStep(0);
    } catch (err) {
      // Form data is preserved so the user can retry
      if (import.meta.env.DEV) console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    clearDraft();
    setDraftRestored(false);
    setValues(INITIAL_VALUES);
    setErrors({});
    clearErrors();
    onCancel();
  }, [onCancel]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setDraftRestored(false);
    setValues(INITIAL_VALUES);
    setCurrentStep(0);
    setErrors({});
  }, []);

  // ── totalSpaceSqft list helpers ─────────────────────────────────────────────

  const addSpace = () => set('totalSpaceSqft')([...(values.totalSpaceSqft || []), '']);
  const removeSpace = (i) => set('totalSpaceSqft')(values.totalSpaceSqft.filter((_, idx) => idx !== i));
  const setSpace = (i, v) => {
    const next = [...values.totalSpaceSqft];
    next[i] = v === '' ? '' : Number(v);
    set('totalSpaceSqft')(next);
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const m = isMobile;
  const row = (children) => (
    <div className="form-row">{children}</div>
  );
  const col = (children, half = false) => (
    <div className={half && !m ? 'form-col form-col--half' : 'form-col'}>
      {children}
    </div>
  );

  if (!visible) return null;

  return (
    <div className={`warehouse-form-modal${m ? ' is-mobile' : ''}`}>
      <div className={`warehouse-form-shell${loading || submitting ? ' is-busy' : ''}`}>
        {(loading || submitting) && (
          <div className="warehouse-form-overlay" aria-live="polite" aria-busy="true">
            <FormSpinner
              large={m}
              tip={submitting ? 'Saving warehouse...' : 'Loading...'}
            />
          </div>
        )}
        <form className="warehouse-form-inner" onSubmit={handleSubmit}>
          {draftRestored && (
            <div className="warehouse-form-draft-banner" role="status">
              <span>Restored unsaved draft from your last session.</span>
              <button
                type="button"
                className="warehouse-form-draft-banner__dismiss"
                onClick={() => setDraftRestored(false)}
              >
                Keep
              </button>
              <button
                type="button"
                className="warehouse-form-draft-banner__discard"
                onClick={handleDiscardDraft}
              >
                Discard draft
              </button>
            </div>
          )}
          <FormSteps steps={formSteps} current={currentStep} isMobile={m} />

          {/* ── Owner Details ───────────────────────────────────── */}
          <div className={currentStep === 0 ? '' : 'step-hidden'}>
            <Section title="Owner Details">
              {row(<>
                {col(
                  <Field label="Listing Type" required error={errors.listing_type}>
                    <SelectInput mobile={m} value={values.listing_type} onChange={set('listing_type')} placeholder="Select listing type" options={['Rent', 'Sale']} data-field="listing_type" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Warehouse Owner Type">
                    <TextInput mobile={m} value={values.warehouseOwnerType} onChange={set('warehouseOwnerType')} placeholder="Individual/Company/3PL" data-field="warehouseOwnerType" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Owner Company Name" tooltip="Please specify details of company / 3PL.">
                    <TextInput mobile={m} value={values.ownerCompanyName} onChange={set('ownerCompanyName')} placeholder="Company name" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Contact Person" required error={errors.contactPerson}>
                    <TextInput mobile={m} value={values.contactPerson} onChange={set('contactPerson')} placeholder="Contact person name" autoComplete="name" data-field="contactPerson" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Contact Number" required error={errors.contactNumber}>
                    <TextInput mobile={m} value={values.contactNumber} onChange={set('contactNumber')} placeholder="10-digit phone number" type="tel" inputMode="tel" maxLength={15} autoComplete="tel" data-field="contactNumber" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Alternate Phone Number">
                    <TextInput mobile={m} value={values.alt_phone_number} onChange={set('alt_phone_number')} placeholder="Alternate phone" type="tel" inputMode="tel" maxLength={15} />
                  </Field>,
                  true)}
                {col(
                  <Field label="Owner Alternate POC">
                    <TextInput mobile={m} value={values.ownerAltPoc} onChange={set('ownerAltPoc')} placeholder="Alternate point of contact" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Is Broker">
                    <ToggleSwitch checked={values.isBroker === true || values.isBroker === 'true' || values.isBroker === 'Yes'} onChange={(v) => set('isBroker')(v ? 'Yes' : 'No')} />
                  </Field>,
                  true)}
                {col(
                  <Field label="Is Builder">
                    <ToggleSwitch checked={values.is_builder} onChange={set('is_builder')} />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Owner Warmth" tooltip="Rate the owner's personality. Green = positive and collaborative; Yellow = neutral; Red = hard to deal with.">
                    <TextInput mobile={m} value={values.owner_warmnth} onChange={set('owner_warmnth')} placeholder="Green/Yellow/Red" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Owner of Multiple Sites">
                    <TextInput mobile={m} value={values.owner_of_multiple_sites} onChange={set('owner_of_multiple_sites')} placeholder="Yes / No / details" />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Uploaded By" required error={errors.uploadedBy} tooltip="Mention your name.">
                    <TextInput mobile={m} value={values.uploadedBy} onChange={set('uploadedBy')} placeholder="Uploader name" data-field="uploadedBy" />
                  </Field>,
                  true)
              )}
            </Section>
          </div>

          {/* ── Location Details ────────────────────────────────── */}
          <div className={currentStep === 1 ? '' : 'step-hidden'}>
            <Section title="Location Details">
              <Field label="Address" required error={errors.address} tooltip="Please mention the locality, but not the exact address.">
                <TextAreaInput mobile={m} value={values.address} onChange={set('address')} placeholder="Enter locality" rows={m ? 3 : 2} data-field="address" />
              </Field>

              {row(<>
                {col(
                  <Field label="City" required error={errors.city}>
                    <TextInput mobile={m} value={values.city} onChange={set('city')} placeholder="Enter city" autoComplete="address-level2" data-field="city" />
                  </Field>,
                  true)}
                {col(
                  <Field label="State" required error={errors.state}>
                    <TextInput mobile={m} value={values.state} onChange={set('state')} placeholder="Enter state" autoComplete="address-level1" data-field="state" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Postal Code">
                    <TextInput mobile={m} value={values.postalCode} onChange={set('postalCode')} placeholder="Postal code" inputMode="numeric" autoComplete="postal-code" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Zone" required error={errors.zone}>
                    <SelectInput mobile={m} value={values.zone} onChange={set('zone')} placeholder="Select zone" options={ZONES} data-field="zone" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Google Location URL">
                <TextInput mobile={m} value={values.googleLocation} onChange={set('googleLocation')} placeholder="Google Maps URL" type="url" />
              </Field>

              {row(<>
                {col(
                  <Field label="Nearest Bus Transport" tooltip="Please mention the nearest bus stop and its distance.">
                    <TextInput mobile={m} value={values.nearest_transport} onChange={set('nearest_transport')} placeholder="Nearest bus stand / depot" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Distance from Highway">
                    <TextInput mobile={m} value={values.distance_from_highway} onChange={set('distance_from_highway')} placeholder="e.g. 2 km" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Approach Road Width (ft)">
                    <TextInput mobile={m} value={values.approachRoadWidth} onChange={set('approachRoadWidth')} placeholder="Road width" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Land Type">
                    <SelectInput mobile={m} value={values.landType} onChange={set('landType')} placeholder="Select land type" options={LAND_TYPES} />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Pollution Zone">
                    <SelectInput mobile={m} value={values.pollutionZone} onChange={set('pollutionZone')} placeholder="Select pollution zone" options={POLLUTION_ZONES} />
                  </Field>,
                  true)
              )}
            </Section>
          </div>

          {/* ── Warehouse Technical Specifications ──────────────── */}
          <div className={currentStep === 2 ? '' : 'step-hidden'}>
            <Section title="Warehouse Technical Specifications">
              {row(<>
                {col(
                  <Field label="Warehouse Type" required error={errors.warehouseType} tooltip="Please mention PEB / RCC / Shed. Use 'Shed' for old-style godowns.">
                    <TextInput mobile={m} value={values.warehouseType} onChange={set('warehouseType')} placeholder="PEB/RCC/Shed" data-field="warehouseType" />
                  </Field>,
                  true)}
                {col(
                  /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
                  <Field label="Offered Area (sq ft)" required error={errors.totalSpaceSqft} tooltip="Please mention all kinds of areas offered, including partition possibilities.">
                    {(values.totalSpaceSqft || []).map((v, i) => (
                      <div key={i} className="form-inline-row">
                        <input
                          type="number"
                          className="form-input"
                          inputMode="numeric"
                          value={v ?? ''}
                          onChange={e => setSpace(i, e.target.value)}
                          placeholder="Enter space"
                          min={1}
                          data-field="totalSpaceSqft"
                        />
                        {values.totalSpaceSqft.length > 1 && (
                          <button
                            type="button"
                            className="form-icon-btn"
                            onClick={() => removeSpace(i)}
                            aria-label="Remove space value"
                          >
                            −
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSpace} className="form-btn form-btn--dashed">
                      + Add Space Value
                    </button>
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Land Parcel Size" tooltip="Please mention the entire parcel size.">
                    <TextInput mobile={m} value={values.land_parcel_size} onChange={set('land_parcel_size')} placeholder="e.g. 5 acres" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Built-up Area" tooltip="Please mention the entire compound's built-up area.">
                    <TextInput mobile={m} value={values.builtup_area} onChange={set('builtup_area')} placeholder="Built-up area" />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Carpet Area" tooltip="Please mention the entire carpet area.">
                    <TextInput mobile={m} value={values.carpet_area} onChange={set('carpet_area')} placeholder="Carpet area" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Clear Height (ft)" tooltip="Please mention the side height here.">
                    <TextInput mobile={m} value={values.clearHeightFt} onChange={set('clearHeightFt')} placeholder="Clear Height / Side Height" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Centre Height">
                    <TextInput mobile={m} value={values.centreHeight} onChange={set('centreHeight')} placeholder="Centre height" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Plinth Height (ft)">
                    <TextInput mobile={m} value={values.plinthHeightFt} onChange={set('plinthHeightFt')} placeholder="Plinth height / Dock Height" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Number of Docks">
                    <TextInput mobile={m} value={values.numberOfDocks} onChange={set('numberOfDocks')} placeholder="Number of docks" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Dock Dimension (ft)">
                    <TextInput mobile={m} value={values.dockDimension} onChange={set('dockDimension')} placeholder="e.g. 8x10 ft" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Canopy Type">
                    <TextInput mobile={m} value={values.canopyType} onChange={set('canopyType')} placeholder="Running/Shutter/None" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Dock Apron Length (ft)" tooltip="Please mention the distance from the wall to the dock platform for truck movement.">
                    <TextInput mobile={m} value={values.dockApronLengthFt} onChange={set('dockApronLengthFt')} placeholder="Distance from Dock to Wall in ft" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Dock Platform Type">
                    <TextInput mobile={m} value={values.dockPlatformType} onChange={set('dockPlatformType')} placeholder="None/Extended Platform/Running Platform/Cross Dock" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Compound Gate Width (ft)">
                    <TextInput mobile={m} value={values.gateSizeFt} onChange={set('gateSizeFt')} placeholder="Gate Width" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Setback Area" tooltip="Setback area around the box.">
                    <TextInput mobile={m} value={values.setbackArea} onChange={set('setbackArea')} placeholder="e.g. 5m on all sides" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Other Docking Specs" tooltip="Please mention if cross docks, levellers, or other specs are present.">
                <TextAreaInput mobile={m} value={values.otherDockingSpecs} onChange={set('otherDockingSpecs')} placeholder="Other docking specifications" rows={m ? 3 : 2} />
              </Field>

              {row(
                col(
                  <Field label="CC Roads" tooltip="Are there concrete roads around the warehouse?">
                    <ToggleSwitch checked={values.ccRoads === true || values.ccRoads === 'true' || values.ccRoads === 'Yes'} onChange={(v) => set('ccRoads')(v)} />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Flooring Type">
                    <TextInput mobile={m} value={values.flooringType} onChange={set('flooringType')} placeholder="VDF/FM2" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Floor Strength (per sqm)">
                    <TextInput mobile={m} value={values.floorStrengthPerSqm} onChange={set('floorStrengthPerSqm')} placeholder="e.g. 5 T/sqm" />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Ventilation Type" tooltip="Ridge / Turbo / Side Louvers / Windows. Fill what is relevant.">
                    <TextInput mobile={m} value={values.ventilationType} onChange={set('ventilationType')} placeholder="Ridge/Turbo" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Insulation Present">
                    <ToggleSwitch checked={values.insulationPresent === true || values.insulationPresent === 'true' || values.insulationPresent === 'Yes'} onChange={(v) => set('insulationPresent')(v)} />
                  </Field>,
                  true)}
                {col(
                  <Field label="Insulation Type">
                    <TextInput mobile={m} value={values.insulationType} onChange={set('insulationType')} placeholder="Insulation type" />
                  </Field>,
                  true)}
              </>)}

              {row(<>
                {col(
                  <Field label="Lighting Details" tooltip="Please mention LUX level, else the type of lighting provided.">
                    <TextInput mobile={m} value={values.lightingDetails} onChange={set('lightingDetails')} placeholder="Lux Level" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Power (KVA)">
                    <TextInput mobile={m} value={values.powerKva} onChange={set('powerKva')} placeholder="Power in KVA" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Parking Space Availability">
                <TextAreaInput mobile={m} value={values.parkingDockingSpace} onChange={set('parkingDockingSpace')} placeholder="Mention area for seperate parking if available" rows={m ? 3 : 2} />
              </Field>

              {row(<>
                {col(
                  <Field label="Washroom Count">
                    <TextInput mobile={m} value={values.washroom_count} onChange={set('washroom_count')} placeholder="Number of washrooms" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Security Features">
                    <TextInput mobile={m} value={values.wallAndSecurityRoom} onChange={set('wallAndSecurityRoom')} placeholder="eg: Security Room, CCTV etc" />
                  </Field>,
                  true)}
              </>)}

              <Field label="Other Specifications">
                <TextAreaInput mobile={m} value={values.otherSpecifications} onChange={set('otherSpecifications')} placeholder="Other specifications" rows={m ? 3 : 2} />
              </Field>
            </Section>
          </div>

          {/* ── Compliances ─────────────────────────────────────── */}
          <div className={currentStep === 3 ? '' : 'step-hidden'}>
            <Section title="Compliances">
              <Field label="Compliances" required error={errors.compliances}>
                <TextAreaInput mobile={m} value={values.compliances} onChange={set('compliances')} placeholder="Please only mention conversion-related and Fire NOC-related status." rows={m ? 3 : 2} />
              </Field>

              {row(<>
                {col(
                  <Field label="Fire Exits">
                    <TextInput mobile={m} value={values.fire_exits} onChange={set('fire_exits')} placeholder="Number of Fire Exits" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Fire NOC Available">
                    <ToggleSwitch checked={values.fireNocAvailable} onChange={set('fireNocAvailable')} />
                  </Field>,
                  true)}
              </>)}

              {row(
                col(
                  <Field label="Fire Safety Measures">
                    <TextInput mobile={m} value={values.fireSafetyMeasures} onChange={set('fireSafetyMeasures')} placeholder="eg: Hydrants, Sprinklers etc" />
                  </Field>,
                  true)
              )}

              {row(<>
                {col(
                  <Field label="Fire Compliance Certification Type" tooltip="E.g. in Bangalore there is Fire Advisory, or Fire NOC.">
                    <TextInput mobile={m} value={values.fire_compliance_cert_type} onChange={set('fire_compliance_cert_type')} placeholder="Fire Compliance Certifications" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Vaastu Compliance">
                    <ToggleSwitch checked={values.vaastuCompliance} onChange={set('vaastuCompliance')} />
                  </Field>,
                  true)}
              </>)}

            </Section>
          </div>

          {/* ── Commercials ─────────────────────────────────────── */}
          <div className={currentStep === 4 ? '' : 'step-hidden'}>
            <Section title="Commercials">
              {row(
                col(
                  <Field label="Rate per sq ft" required error={errors.ratePerSqft}>
                    <TextInput mobile={m} value={values.ratePerSqft} onChange={set('ratePerSqft')} placeholder="Rate per sq ft" data-field="ratePerSqft" />
                  </Field>,
                  true)
              )}

              {row(
                col(
                  <Field label="Availability">
                    <TextInput mobile={m} value={values.availability} onChange={set('availability')} placeholder="Please mention the date of availability." />
                  </Field>,
                  true)
              )}
            </Section>
          </div>

          {/* ── Media ────────────────────────────────────────── */}
          <div className={currentStep === 5 ? '' : 'step-hidden'}>
            <Section title="Media">
              <Field label="Upload Files, Layout, Images and Videos">
                <FileUpload value={values.media} onChange={set('media')} onUploadingChange={setMediaUploading} uploadedBy={values.uploadedBy} />
              </Field>
            </Section>
          </div>

          {/* ── Actions ─────────────────────────────────────────── */}
          {mediaUploading && currentStep === formSteps.length - 1 && (
            <div className="warehouse-form-upload-warning" role="status">
              Media is still uploading — submit will be enabled once it completes.
            </div>
          )}
          <div className={m ? 'form-actions form-actions--stack' : 'form-actions'}>
            <button type="button" className="form-btn form-btn--ghost form-btn--cancel" onClick={handleCancel}>
              Cancel
            </button>
            {currentStep > 0 && (
              <button type="button" className="form-btn form-btn--ghost form-btn--prev" onClick={handlePrev}>
                Previous
              </button>
            )}
            {currentStep < formSteps.length - 1 ? (
              <button type="button" className="form-btn form-btn--primary" onClick={handleNext}>
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="form-btn form-btn--primary"
                disabled={loading || submitting || mediaUploading}
                title={mediaUploading ? 'Waiting for media uploads to finish' : undefined}
              >
                {submitting
                  ? (m ? 'Saving...' : 'Saving')
                  : mediaUploading
                    ? 'Uploading media…'
                    : `${initialData ? 'Update' : 'Create'} Warehouse`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default WarehouseForm;
