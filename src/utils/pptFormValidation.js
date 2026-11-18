import { MEASUREMENTS, serializeMeasurement, serializeWashrooms, serializeVentilation } from './formFields';
import { pptFormIssues } from './pptFormPolicy';

// Validate the values that will be sent, not the structured input-state objects.
export function pptFormErrors(values, original) {
  const serialized = { ...values };
  // Form controls own the flat values. A restored draft's stale API-shaped
  // objects must not override the answers that buildPayload will actually send.
  delete serialized.WarehouseData;
  delete serialized.warehouseData;
  const errors = {};
  for (const key of Object.keys(MEASUREMENTS)) {
    try { serialized[key] = serializeMeasurement(values[key], key); }
    catch (error) { errors[key] = error.message; }
  }
  try { serialized.washroom_count = serializeWashrooms(values.washroom_count); }
  catch (error) { errors.washroom_count = error.message; }
  serialized.ventilationType = serializeVentilation(values.ventilationType);
  for (const issue of pptFormIssues(original, serialized)) {
    const key = issue.path.at(-1), variable = String(values.handoverType).toUpperCase() === 'VARIABLE';
    if (key === 'handoverDate' && variable) errors.handoverType ||= `Switch to Fixed to correct the handover date. ${issue.message}`;
    else if (['handoverLeadValue', 'handoverLeadUnit'].includes(key) && !variable) {
      errors.handoverType ||= `Switch to Variable to correct the lead time. ${issue.message}`;
    } else errors[key] ||= issue.message;
  }
  return errors;
}
