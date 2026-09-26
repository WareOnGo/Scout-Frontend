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
