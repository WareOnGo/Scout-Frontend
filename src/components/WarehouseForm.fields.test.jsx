import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../services/warehouseService', () => ({ warehouseService: { getPresignedUrl: vi.fn() } }));
import WarehouseForm from './WarehouseForm';
import { MEASUREMENTS } from '../utils/formFields';

const key = 'warehouseForm:draft:v1';
const required = { listing_type: 'Rent', warehouseType: 'PEB', address: 'Test locality', city: 'New Delhi', state: 'Delhi',
  contactPerson: 'Test owner', contactNumber: '9999999999', uploadedBy: 'SCOUT', totalSpaceSqft: [10000], ratePerSqft: '25',
  compliances: 'CLU confirmed', landType: 'Warehouse CLU', googleLocation: 'https://www.google.com/maps?q=12.9,77.6' };
const field = name => document.querySelector(`[data-field="${name}"]`);
const change = (element, value) => fireEvent.change(element, { target: { value } });
function draft(extra = {}, step = 2) {
  localStorage.setItem(key, JSON.stringify({ values: { ...required, ...extra }, currentStep: step }));
}
async function submit(onSubmit) {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Go to Scout Notes' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Go to Scout Notes' }));
  const button = screen.getByRole('button', { name: /(?:Create|Update) Warehouse/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  return onSubmit.mock.calls[0][0];
}

describe('Scout structured form', () => {
  it('shows character feedback before navigation only for the new measurement inputs', async () => {
    draft();
    await act(async () => { render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />); });
    change(field('clearHeightFt'), '50x');
    expect(field('clearHeightFt')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Use digits and at most one decimal point');
    change(field('clearHeightFt'), '50.5');
    change(screen.getByLabelText('Male washrooms'), 'x');
    expect(field('clearHeightFt')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText('Male washrooms')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends every measurement, international contacts, dropdowns, dimensions and washrooms through the existing fields', async () => {
    draft({ setbackArea: '5m on all sides', nearest_transport: 'Legacy bus station' });
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    for (const [name, config] of Object.entries(MEASUREMENTS)) {
      change(field(name), '50.5');
      for (let index = 1; index < (config.parts?.length || 1); index++) change(field(`${name}-${index}`), '20');
      if (config.units.length > 1) change(screen.getByLabelText(`${config.label} unit`), config.units.at(-1));
    }
    change(screen.getByLabelText('Contact Number country code'), 'GB');
    change(field('contactNumber'), '02079460123');
    change(screen.getByLabelText('Alternate Phone Number country code'), 'US');
    change(field('alt_phone_number'), '2025550123');
    change(screen.getByLabelText('Male washrooms'), '0');
    change(screen.getByLabelText('Female washrooms'), '3');
    change(field('canopyType'), 'Running');
    change(field('dockPlatformType'), 'Inward');
    change(field('flooringType'), 'FM2');
    fireEvent.click(screen.getByLabelText('Ventilation Type options'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ridge' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Turbo' }));
    const payload = await submit(onSubmit);
    expect(payload).toMatchObject({ contactNumber: '+442079460123', alt_phone_number: '+12025550123',
      clearHeightFt: '50.5 metres', builtup_area: '50.5 sq m', land_parcel_size: '50.5 sq m',
      dockDimension: '50.5 x 20 metres', lightingDetails: '50.5 lux', floorStrengthPerSqm: '50.5 tonnes/sq m',
      washroom_count: 'Male: 0; Female: 3', ventilationType: 'Ridge, Turbo', canopyType: 'Running',
      dockPlatformType: 'Inward', flooringType: 'FM2', setbackArea: '5m on all sides', nearest_transport: 'Legacy bus station',
      warehouseData: { powerKva: '50.5 HP', dimensions: '50.5 x 20 x 20 metres', approachRoadWidth: '50.5 metres' } });
    expect(JSON.stringify(payload)).not.toContain('"kind"');
    expect(localStorage.getItem(key)).toBeNull();
    expect(screen.queryByText('Nearest Bus Transport')).toBeNull();
  }, 30000);

  it('blocks new submissions missing land/location and invalid partial dimensions', async () => {
    draft({ landType: '', googleLocation: '' }, 1);
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText('Land Type is required')).toBeInTheDocument();
    expect(screen.getByText('Google Location URL is required')).toBeInTheDocument();
    change(field('landType'), 'Agricultural CLU');
    change(field('googleLocation'), required.googleLocation);
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    change(field('dimensions'), '100');
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText('Complete every dimension or clear them all.')).toBeInTheDocument();
  });

  it('preserves legacy edits without requiring previously missing location/land fields', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} initialData={{ ...required,
      googleLocation: '', warehouseData: { landType: '', approachRoadWidth: '40-50 ft' },
      clearHeightFt: '30–40 ft', lightingDetails: 'LED', washroom_count: '5', ventilationType: 'Custom vents',
      builtup_area: '50000', canopyType: 'Old canopy', uploadedBy: 'Existing scout' }} />);
    const payload = await submit(onSubmit);
    expect(payload).toMatchObject({ clearHeightFt: '30–40 ft', lightingDetails: 'LED', washroom_count: '5',
      ventilationType: 'Custom vents', builtup_area: '50000', canopyType: 'Old canopy', uploadedBy: 'Existing scout',
      googleLocation: null, warehouseData: { landType: null, approachRoadWidth: '40-50 ft' } });
  });

  it('migrates a saved draft, retains uploads and restores edited split values after reload', async () => {
    draft({ media: { images: ['https://example.test/photo.jpg'], videos: [], docs: [] }, clearHeightFt: '30 ft' });
    const view = render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    change(field('clearHeightFt'), '12.5');
    change(screen.getByLabelText('Clear Height unit'), 'metres');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(key)).version).toBe(2));
    const saved = JSON.parse(localStorage.getItem(key));
    expect(saved.values.clearHeightFt).toMatchObject({ parts: ['12.5'], unit: 'metres', edited: true });
    expect(saved.values.media.images).toEqual(['https://example.test/photo.jpg']);
    view.unmount();
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(field('clearHeightFt').value).toBe('12.5');
    expect(screen.getByLabelText('Clear Height unit').value).toBe('metres');
  });

  it('submits a short Maps link without checking its pin or showing a retry control', async () => {
    const googleLocation = 'https://maps.app.goo.gl/ttMpsPTNwLcrdHas5';
    draft({ googleLocation }, 1);
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    const payload = await submit(onSubmit);
    expect(payload.googleLocation).toBe(googleLocation);
    expect(screen.queryByRole('button', { name: 'Retry location check' })).toBeNull();
    expect(screen.queryByText('Location verified')).toBeNull();
  });

  it('pastes international numbers into the matching country without changing Employee ID', async () => {
    const user = userEvent.setup();
    render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByLabelText('Contact Number', { exact: true }));
    await user.paste('+44 20 7946 0123');
    expect(screen.getByLabelText('Contact Number country code').value).toBe('GB');
    expect(field('contactNumber').value).toBe('2079460123');
    expect(field('uploadedBy')).toBeInTheDocument();
  });
});
