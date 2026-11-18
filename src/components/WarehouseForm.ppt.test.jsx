import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { completePptForm } from '../test/pptFormFixture';
import WarehouseForm from './WarehouseForm';
vi.mock('../services/warehouseService', () => ({ warehouseService: { getPresignedUrl: vi.fn() } }));
const key = 'warehouseForm:draft:v1';
const input = field => document.querySelector(`[data-field="${field}"]`);
const change = (field, value) => fireEvent.change(input(field), { target: { value } });
const controls = ['clearHeightFt', 'floorStrengthPerSqm', 'numberOfDocks', 'plinthHeightFt', 'canopyType', 'flooringType',
  'ventilationType', 'powerKva', 'washroom_count', 'fireNocAvailable', 'fireSafetyMeasures'];
test.each(controls)('a saved %s cannot be cleared through the Scout form', async field => {
  const row = completePptForm(), onSubmit = vi.fn();
  await act(async () => render(<WarehouseForm visible initialData={{ ...row, id: 123, WarehouseData: row.warehouseData }}
    onSubmit={onSubmit} onCancel={vi.fn()} />));
  const step = ['fireNocAvailable', 'fireSafetyMeasures'].includes(field) ? 'Compliances' : 'Technical Specs';
  fireEvent.click(screen.getByRole('button', { name: `Go to ${step}` }));
  if (field === 'ventilationType') { fireEvent.click(input(field)); fireEvent.click(screen.getByRole('checkbox', { name: 'None' })); }
  else if (field === 'powerKva') fireEvent.click(screen.getByLabelText('As per requirement'));
  else { change(field, ''); if (field === 'washroom_count') change('femaleWashrooms', ''); }
  fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input(field)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: step, exact: true })).toHaveAttribute('aria-current', 'step');
});
test('a final-step restored draft rechecks earlier mandatory specifications before submitting', async () => {
  const row = completePptForm(), onSubmit = vi.fn();
  localStorage.setItem(key, JSON.stringify({ version: 3, currentStep: 6,
    values: { ...row, ...row.warehouseData, handoverType: 'Fixed', clearHeightFt: '' } }));
  await act(async () => render(<WarehouseForm visible onSubmit={onSubmit} onCancel={vi.fn()} />));
  const save = screen.getByRole('button', { name: 'Create Warehouse' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input('clearHeightFt')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Technical Specs', exact: true })).toHaveAttribute('aria-current', 'step');
});
test('older draft defaults cannot silently answer No to Fire NOC', async () => {
  const row = completePptForm();
  localStorage.setItem(key, JSON.stringify({ version: 2, currentStep: 3, values: { ...row, ...row.warehouseData, handoverType: 'Fixed' } }));
  await act(async () => render(<WarehouseForm visible onSubmit={vi.fn()} onCancel={vi.fn()} />));
  expect(input('fireNocAvailable')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
  expect(input('fireNocAvailable')).toHaveAttribute('aria-invalid', 'true');
  change('fireNocAvailable', 'No');
  fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
  expect(screen.getByRole('button', { name: 'Commercials', exact: true })).toHaveAttribute('aria-current', 'step');
});
test.each(['washroom_count', 'femaleWashrooms'])('saved %s remains protected when the other count is present', async key => {
  const row = completePptForm();
  await act(async () => render(<WarehouseForm visible initialData={{ ...row, id: 123, WarehouseData: row.warehouseData, washroom_count: 'Male: 3; Female: 2' }}
    onSubmit={vi.fn()} onCancel={vi.fn()} />));
  fireEvent.click(screen.getByRole('button', { name: 'Go to Technical Specs' }));
  change(key, '');
  fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
  expect(input(key)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Technical Specs', exact: true })).toHaveAttribute('aria-current', 'step');
});
test('clearing saved inactive timing highlights the mode selector in Scout', async () => {
  const row = completePptForm();
  await act(async () => render(<WarehouseForm visible initialData={{ ...row, id: 123, WarehouseData: row.warehouseData, handoverLeadValue: 2, handoverLeadUnit: 'WEEKS' }}
    onSubmit={vi.fn()} onCancel={vi.fn()} />));
  fireEvent.click(screen.getByRole('button', { name: 'Go to Commercials' }));
  change('handoverDate', ''); change('handoverType', 'Variable');
  fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
  expect(input('handoverType')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText(/Switch to Fixed to correct the handover date/)).toBeVisible();
});
