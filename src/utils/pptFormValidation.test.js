import { test, expect } from 'vitest';
import { completePptForm } from '../test/pptFormFixture';
import { hydrateMeasurements } from './formFields';
import { pptFormErrors } from './pptFormValidation';
const values = () => {
  const row = completePptForm();
  return hydrateMeasurements({ ...row, ...row.warehouseData, handoverType: 'Fixed' });
};
test('structured controls are validated as the values actually submitted', () => {
  expect(pptFormErrors(values(), null)).toEqual({});
});
test('a restored nested snapshot cannot hide blank flat controls', () => {
  const raw = values(); raw.fireNocAvailable = null; raw.fireSafetyMeasures = '';
  raw.WarehouseData = completePptForm().warehouseData;
  expect(pptFormErrors(raw, null)).toMatchObject({ fireNocAvailable: 'Fire NOC Available is required.', fireSafetyMeasures: 'Fire Safety Measures is required.' });
});
test('old empty boolean answers are preserved and explicit No is accepted', () => {
  const original = completePptForm(); original.warehouseData.fireNocAvailable = null;
  const raw = values(); raw.fireNocAvailable = null;
  expect(pptFormErrors(raw, original)).toEqual({});
  raw.fireNocAvailable = false;
  expect(pptFormErrors(raw, original)).toEqual({});
});
