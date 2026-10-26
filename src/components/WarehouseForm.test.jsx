import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Block real network from FileUpload's service calls in case the user ever
// reaches the Media step in a test.
vi.mock('../services/warehouseService', () => ({
  warehouseService: {
    getPresignedUrl: vi.fn(),
  },
}));

import WarehouseForm from './WarehouseForm';

const DRAFT_KEY = 'warehouseForm:draft:v1';

const setDesktop = () => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
};

const fillStep0 = async (user, overrides = {}) => {
  const defaults = {
    listing_type: 'Rent',
    contactPerson: 'Asha',
    contactNumber: '9999999999',
    uploadedBy: 'VBHIWH',
    ...overrides,
  };
  // Step 0 inputs by data-field
  const ltSelect = document.querySelector('[data-field="listing_type"]');
  await user.selectOptions(ltSelect, defaults.listing_type);
  await user.type(document.querySelector('[data-field="contactPerson"]'), defaults.contactPerson);
  await user.type(document.querySelector('[data-field="contactNumber"]'), defaults.contactNumber);
  await user.type(document.querySelector('[data-field="uploadedBy"]'), defaults.uploadedBy);
};

beforeEach(() => {
  setDesktop();
  localStorage.clear();
});

describe('WarehouseForm — navigation', () => {
  it('NAV-1: starts on the Owner Details step with no Previous button', () => {
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Owner Details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^previous$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('NAV-4: blocks Next when required fields are missing', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    // Still on Step 0
    expect(screen.getByRole('heading', { name: 'Owner Details' })).toBeInTheDocument();
    expect(screen.getByText('Listing type is required')).toBeInTheDocument();
  });

  it('NAV-5: advances on a valid step', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await fillStep0(user);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { name: 'Location Details' })).toBeInTheDocument();
  });

  it('NAV-6: blocks Next when the contact number is malformed', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await fillStep0(user, { contactNumber: 'abc123' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    // Still on Step 0, with a blocking error
    expect(screen.getByRole('heading', { name: 'Owner Details' })).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid phone number/i)).toBeInTheDocument();
  });

  it('NAV-7: advances when contact number uses a +91 / whitespace format', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await fillStep0(user, { contactNumber: '+91 98765 43210' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { name: 'Location Details' })).toBeInTheDocument();
  });

  it('NAV-8: blocks Next when a non-empty alternate phone is malformed', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await fillStep0(user);
    await user.type(document.querySelector('[data-field="alt_phone_number"]'), 'not-a-number');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { name: 'Owner Details' })).toBeInTheDocument();
  });

  it('NAV-9: advances when the optional alternate phone is left blank', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await fillStep0(user);
    // alt_phone_number untouched
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { name: 'Location Details' })).toBeInTheDocument();
  });
});

describe('WarehouseForm — required-field validation', () => {
  it('VAL-OWN-1: listing_type missing → "Listing type is required"', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(document.querySelector('[data-field="contactPerson"]'), 'a');
    await user.type(document.querySelector('[data-field="contactNumber"]'), '9');
    await user.type(document.querySelector('[data-field="uploadedBy"]'), 'V');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('Listing type is required')).toBeInTheDocument();
  });

  it('VAL-OWN-2,3,4: contactPerson / contactNumber / uploadedBy all surface their messages', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const ltSelect = document.querySelector('[data-field="listing_type"]');
    await user.selectOptions(ltSelect, 'Rent');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('Contact person is required')).toBeInTheDocument();
    expect(screen.getByText('Contact number is required')).toBeInTheDocument();
    expect(screen.getByText('Uploaded by is required')).toBeInTheDocument();
  });
});

describe('WarehouseForm — draft persistence', () => {
  it('DRAFT-1: with no draft and no initialData, the form opens blank', () => {
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/Restored unsaved draft/i)).toBeNull();
    expect(document.querySelector('[data-field="contactPerson"]').value).toBe('');
  });

  it('DRAFT-2: with a valid stored draft, the banner appears and values restore', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        values: {
          listing_type: 'Rent',
          contactPerson: 'Restored Person',
          contactNumber: '5555555555',
          uploadedBy: 'V1',
          totalSpaceSqft: [1500],
        },
        currentStep: 0,
        savedAt: Date.now(),
      })
    );
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/Restored unsaved draft/i)).toBeInTheDocument();
    expect(document.querySelector('[data-field="contactPerson"]').value).toBe('Restored Person');
  });

  it('DRAFT-3: with initialData (edit mode), draft is ignored', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ values: { contactPerson: 'FROM-DRAFT' }, currentStep: 0 })
    );
    render(
      <WarehouseForm
        visible={true}
        initialData={{ contactPerson: 'FROM-DATA', warehouseType: 'PEB' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText(/Restored unsaved draft/i)).toBeNull();
    expect(document.querySelector('[data-field="contactPerson"]').value).toBe('FROM-DATA');
  });

  it('DRAFT-7: corrupt JSON in storage falls back to defaults without crashing', () => {
    localStorage.setItem(DRAFT_KEY, '{not json');
    expect(() =>
      render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    ).not.toThrow();
    expect(screen.queryByText(/Restored unsaved draft/i)).toBeNull();
  });

  it('DRAFT-12: handleCancel clears the draft and calls onCancel', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ values: { contactPerson: 'X' }, currentStep: 0 }));
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('WarehouseForm — SelectInput (current) preservation', () => {
  it('SEL-3: off-list value is rendered as "<value> (current)" and stays selected', () => {
    render(
      <WarehouseForm
        visible={true}
        initialData={{
          warehouseType: 'Tin Shed',
          contactPerson: 'a',
          contactNumber: '1',
          uploadedBy: 'V',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const select = document.querySelector('[data-field="warehouseType"]');
    expect(select.value).toBe('Tin Shed');
    expect(within(select).getByText('Tin Shed (current)')).toBeInTheDocument();
    // Standard options still present
    expect(within(select).getByText('PEB')).toBeInTheDocument();
    expect(within(select).getByText('BTS')).toBeInTheDocument();
  });
});

describe('WarehouseForm — availability and readiness', () => {
  const validValues = {
    listing_type: 'Rent', warehouseType: 'PEB', address: 'Test warehouse',
    city: 'Bangalore', state: 'Karnataka', contactPerson: 'Test Owner',
    contactNumber: '9999999999', uploadedBy: 'TEST', compliances: 'CLU', ratePerSqft: '25',
    totalSpaceSqft: [10000], availability: 'Yes',
  };
  const field = name => document.querySelector(`[data-field="${name}"]`);
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const restoreDraft = (values = {}, currentStep = 4) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      values: { ...validValues, ...values }, currentStep, savedAt: Date.now(),
    }));
  };
  const submitForm = async (user, onSubmit, buttonName = /Create Warehouse/i) => {
    await user.click(screen.getByRole('button', { name: 'Go to Scout Notes' }));
    const button = screen.getByRole('button', { name: buttonName });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    return onSubmit.mock.calls[0][0];
  };

  it('prefills date-only fields from API timestamps and submits fixed handover and construction status', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} initialData={{
      ...validValues, availabilityLastReviewedOn: '2026-10-01T00:00:00.000Z',
      handoverType: 'FIXED', handoverDate: '2027-01-15T00:00:00.000Z',
      lockInDate: '2027-01-01T00:00:00.000Z', status: 'Under construction',
    }} />);
    await user.click(screen.getByRole('button', { name: 'Go to Commercials' }));
    expect(field('availabilityLastReviewedOn')).toHaveValue('2026-10-01');
    expect(field('handoverDate')).toHaveValue('2027-01-15');
    expect(field('lockInDate')).toHaveValue('2027-01-01');
    expect(field('status')).toHaveValue('Under construction');
    fireEvent.change(field('availabilityLastReviewedOn'), { target: { value: '2026-10-02' } });
    fireEvent.change(field('handoverDate'), { target: { value: '2027-02-15' } });
    fireEvent.change(field('lockInDate'), { target: { value: '2027-02-01' } });
    await user.selectOptions(field('status'), 'Ready to move');

    expect(await submitForm(user, onSubmit, /Update Warehouse/i)).toMatchObject({
      availability: 'Yes', availabilityLastReviewedOn: '2026-10-02',
      handoverType: 'FIXED', handoverDate: '2027-02-15', handoverLeadValue: null,
      handoverLeadUnit: null, lockInDate: '2027-02-01', status: 'Ready to move',
    });
  });

  it('preserves both handover modes, saves them in drafts and submits numeric lead time with API enums', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    restoreDraft();
    const { unmount } = render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(field('availabilityLastReviewedOn'), { target: { value: '2026-10-01' } });
    fireEvent.change(field('handoverDate'), { target: { value: '2027-01-15' } });
    fireEvent.change(field('lockInDate'), { target: { value: '2027-01-01' } });
    await user.selectOptions(field('status'), 'Build to suit');
    await user.selectOptions(field('handoverType'), 'Variable');
    expect(field('handoverDate')).toBeNull();
    fireEvent.change(field('handoverLeadValue'), { target: { value: '3' } });
    await user.selectOptions(field('handoverLeadUnit'), 'Weeks');
    const expectedDraft = {
      availabilityLastReviewedOn: '2026-10-01', handoverDate: '2027-01-15',
      handoverType: 'Variable', handoverLeadValue: '3', handoverLeadUnit: 'Weeks',
      lockInDate: '2027-01-01', status: 'Build to suit',
    };
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).values).toMatchObject(expectedDraft));
    unmount();
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(field('handoverType')).toHaveValue('Variable');
    expect(field('handoverLeadValue')).toHaveValue(3);
    expect(field('handoverLeadUnit')).toHaveValue('Weeks');
    expect(field('availabilityLastReviewedOn')).toHaveValue('2026-10-01');
    expect(field('lockInDate')).toHaveValue('2027-01-01');
    expect(field('status')).toHaveValue('Build to suit');
    await user.selectOptions(field('handoverType'), 'Fixed');
    expect(field('handoverDate')).toHaveValue('2027-01-15');
    expect(field('handoverLeadValue')).toBeNull();
    await user.selectOptions(field('handoverType'), 'Variable');
    expect(field('handoverLeadValue')).toHaveValue(3);
    expect(field('handoverLeadUnit')).toHaveValue('Weeks');

    expect(await submitForm(user, onSubmit)).toMatchObject({
      ...expectedDraft, handoverType: 'VARIABLE', handoverLeadValue: 3, handoverLeadUnit: 'WEEKS',
    });
  });

  it('prefills variable handover from API enums', async () => {
    await act(async () => { render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} initialData={{
      ...validValues, handoverType: 'VARIABLE', handoverLeadValue: 10, handoverLeadUnit: 'DAYS',
    }} />); });
    expect(field('handoverType')).toHaveValue('Variable');
    expect(field('handoverLeadValue')).toHaveValue(10);
    expect(field('handoverLeadUnit')).toHaveValue('Days');
  });

  it('preserves a missing unit when an unrelated field is edited', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} initialData={{
      ...validValues, handoverType: 'VARIABLE', handoverLeadValue: 2, handoverLeadUnit: null,
    }} />);
    await user.click(screen.getByRole('button', { name: 'Go to Commercials' }));
    expect(field('handoverLeadUnit')).toHaveValue('');
    fireEvent.change(field('ratePerSqft'), { target: { value: '26' } });
    expect(await submitForm(user, onSubmit, /Update Warehouse/i)).toMatchObject({
      ratePerSqft: '26', handoverType: 'VARIABLE', handoverLeadValue: 2, handoverLeadUnit: null,
    });
  });

  it('starts a new variable handover without an assumed unit and keeps it saveable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    restoreDraft({ handoverType: 'Variable', handoverLeadValue: '2' });
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(field('handoverLeadUnit')).toHaveValue('');
    expect(await submitForm(user, onSubmit)).toMatchObject({
      handoverType: 'VARIABLE', handoverLeadValue: 2, handoverLeadUnit: null,
    });
  });

  it.each(['0', '-1', '1.5', '121'])('blocks invalid lead time %s before leaving Commercials', async value => {
    const user = userEvent.setup();
    restoreDraft({ handoverType: 'Variable', handoverLeadValue: value });
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('Lead time must be a whole number between 1 and 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Media', exact: true })).toBeDisabled();
    fireEvent.change(field('handoverLeadValue'), { target: { value: '120' } });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('button', { name: 'Go to Scout Notes' })).toBeEnabled();
  });

  it('requires availability when a review date is supplied', async () => {
    const user = userEvent.setup();
    restoreDraft({ availability: '', availabilityLastReviewedOn: '2026-10-01' });
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('Select availability before recording a review date')).toBeInTheDocument();
  });

  it('offers Yes/No and suggests today for a saved Yes-to-No change like the dashboard', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    restoreDraft({ availabilityLastReviewedOn: '2026-10-01' });
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(field('availability').tagName).toBe('SELECT');
    expect([...field('availability').options].map(option => option.value)).toEqual(['', 'Yes', 'No']);
    await user.selectOptions(field('availability'), 'No');
    expect(field('availabilityLastReviewedOn')).toHaveValue(today());
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).values).toMatchObject({
      availability: 'No', availabilityLastReviewedOn: today(),
    }));
    expect(await submitForm(user, onSubmit)).toMatchObject({ availability: 'No', availabilityLastReviewedOn: today() });
  });

  it.each(['yes', ' Yes ', 'YES'])('keeps the review date for an equivalent availability value %s', async availability => {
    restoreDraft({ availability, availabilityLastReviewedOn: '2026-10-01' });
    await act(async () => { render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />); });
    fireEvent.change(field('availability'), { target: { value: 'Yes' } });
    expect(field('availabilityLastReviewedOn')).toHaveValue('2026-10-01');
  });

  it('preserves an existing nonstandard availability answer until the scout selects Yes or No', async () => {
    const user = userEvent.setup();
    restoreDraft({ availability: 'Immediate', availabilityLastReviewedOn: '2026-10-01' });
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(field('availability')).toHaveValue('Immediate');
    expect(within(field('availability')).getByRole('option', { name: 'Immediate (current)' })).toBeInTheDocument();
    await user.selectOptions(field('availability'), 'No');
    expect(field('availabilityLastReviewedOn')).toHaveValue('');
  });

  it('restores the original check date when availability is changed back, unless a date was chosen manually', async () => {
    const user = userEvent.setup();
    restoreDraft({ availabilityLastReviewedOn: '2026-10-01' });
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.selectOptions(field('availability'), 'No');
    expect(field('availabilityLastReviewedOn')).toHaveValue(today());
    await user.selectOptions(field('availability'), 'Yes');
    expect(field('availabilityLastReviewedOn')).toHaveValue('2026-10-01');
    fireEvent.change(field('availabilityLastReviewedOn'), { target: { value: '2026-09-30' } });
    await user.selectOptions(field('availability'), 'No');
    expect(field('availabilityLastReviewedOn')).toHaveValue('2026-09-30');
    expect(screen.getByText('This replaces a more recent review date. Check that you are correcting the recorded date.')).toHaveAttribute('role', 'status');
  });

  it('allows clearing construction status, restores that choice and keeps a newly selected review date', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    restoreDraft({ availabilityLastReviewedOn: '2026-10-01' });
    const { unmount } = render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(field('availability'), { target: { value: 'No' } });
    fireEvent.change(field('availabilityLastReviewedOn'), { target: { value: '2026-10-02' } });
    await user.selectOptions(field('status'), 'Ready to move');
    await user.selectOptions(field('status'), '');
    expect(field('status')).toHaveValue('');
    expect(within(field('status')).getByRole('option', { name: 'Not recorded' })).toBeEnabled();
    expect(field('listing_type').querySelector('option[value=""]')).toBeDisabled();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).values).toMatchObject({
      availability: 'No', availabilityLastReviewedOn: '2026-10-02', status: '',
    }));
    unmount();
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(field('status')).toHaveValue('');
    expect(field('availabilityLastReviewedOn')).toHaveValue('2026-10-02');
    expect(await submitForm(user, onSubmit)).toMatchObject({
      availability: 'No', availabilityLastReviewedOn: '2026-10-02', status: null,
    });
  });

  it('resets partial native review-date input and its error when availability changes', async () => {
    const user = userEvent.setup();
    restoreDraft();
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const previousInput = field('availabilityLastReviewedOn');
    vi.spyOn(previousInput, 'validity', 'get').mockReturnValue({ badInput: true });
    fireEvent.keyUp(previousInput, { key: '0' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('Enter a complete, valid date')).toBeInTheDocument();
    fireEvent.change(field('availability'), { target: { value: 'No' } });
    expect(field('availabilityLastReviewedOn')).not.toBe(previousInput);
    expect(field('availabilityLastReviewedOn')).toHaveValue(today());
    expect(screen.queryByText('Enter a complete, valid date')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('button', { name: 'Go to Scout Notes' })).toBeEnabled();
  });

  it.each(['availabilityLastReviewedOn', 'handoverDate', 'lockInDate', 'handoverLeadValue'])(
    'blocks partial native input in %s even when the browser reports an empty value', async key => {
      const user = userEvent.setup();
      restoreDraft({ handoverType: key === 'handoverLeadValue' ? 'Variable' : 'Fixed' });
      render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
      const input = field(key);
      // jsdom doesn't model the date editor's segments or invalid numeric text.
      // Real browsers return value="" with badInput=true for these partial entries.
      const validity = vi.spyOn(input, 'validity', 'get').mockReturnValue({ badInput: true });
      if (key === 'handoverLeadValue') fireEvent.input(input);
      else fireEvent.keyUp(input, { key: '0' });
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('button', { name: 'Media', exact: true })).toBeDisabled();

      validity.mockReturnValue({ badInput: false });
      fireEvent.input(input, { target: { value: key === 'handoverLeadValue' ? '2' : '2026-10-01' } });
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByRole('button', { name: 'Go to Scout Notes' })).toBeEnabled();
    },
  );

  it.each(['availabilityLastReviewedOn', 'handoverDate', 'lockInDate'])(
    'rejects an impossible calendar date restored into %s', async key => {
      const user = userEvent.setup();
      restoreDraft({ [key]: '2025-02-30' });
      render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByText('Enter a complete, valid date')).toBeInTheDocument();
      expect(field(key)).toHaveAttribute('aria-invalid', 'true');
      fireEvent.change(field(key), { target: { value: '2024-02-29' } });
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByRole('button', { name: 'Go to Scout Notes' })).toBeEnabled();
    },
  );

  it('limits review dates to today in India when UTC is still on the previous date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T20:00:00.000Z'));
    try {
      restoreDraft({ availabilityLastReviewedOn: '2026-10-26' });
      await act(async () => { render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />); });
      expect(field('availabilityLastReviewedOn')).toHaveAttribute('max', '2026-10-25');
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByText('Review date cannot be in the future')).toBeInTheDocument();
      fireEvent.change(field('availabilityLastReviewedOn'), { target: { value: '2026-10-25' } });
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByRole('button', { name: 'Go to Scout Notes' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps readiness optional for existing drafts without the new fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    restoreDraft();
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(await submitForm(user, onSubmit)).toMatchObject({
      availabilityLastReviewedOn: null, handoverType: 'FIXED', handoverDate: null,
      handoverLeadValue: null, handoverLeadUnit: null, lockInDate: null, status: null,
    });
  });

  it.each(['Variable', 'Fixed'])('rechecks an invalid final-step draft with %s handover before submitting', async handoverType => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    restoreDraft({ handoverType, handoverLeadValue: '121' }, 6);
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    const button = screen.getByRole('button', { name: /Create Warehouse/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/whole number between 1 and 120/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });
});

describe('WarehouseForm — submit guard', () => {
  it('submits edited area options without the stale legacy field', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={onSubmit} onCancel={vi.fn()} initialData={{
      listing_type: 'Rent', warehouseType: 'PEB', address: 'Test warehouse',
      city: 'Bangalore', state: 'Karnataka', contactPerson: 'Test Owner',
      contactNumber: '9999999999', uploadedBy: 'TEST', compliances: 'CLU', ratePerSqft: '25',
      totalSpaceSqft: [10000, 5000], offeredSpaceSqft: '99999',
    }} />);
    fireEvent.change(document.querySelector('[data-field="totalSpaceSqft"]'), { target: { value: '15000' } });
    for (let step = 0; step < 6; step++) await user.click(screen.getByRole('button', { name: /^next$/i }));
    const submit = screen.getByRole('button', { name: /Update Warehouse/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].totalSpaceSqft).toEqual([15000, 5000]);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('offeredSpaceSqft');
  });

  it('PAY-11: pressing Enter on Step 0 does NOT call onSubmit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<WarehouseForm visible={true} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await fillStep0(user);
    // Press Enter inside contactPerson
    const cp = document.querySelector('[data-field="contactPerson"]');
    cp.focus();
    await act(async () => {
      await user.keyboard('{Enter}');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('PAY-12: when not visible, returns null', () => {
    const { container } = render(
      <WarehouseForm visible={false} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
