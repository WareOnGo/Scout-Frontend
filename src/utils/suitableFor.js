/**
 * Use-cases a warehouse suits — the options behind Warehouse.suitableFor.
 *
 * Stored as stable codes with the label kept here, the same arrangement as
 * waterSupply.js. Renaming a label is then a change in this file rather than a
 * data migration across every row that carries the old string.
 *
 * This list is duplicated in three places by design of the repo layout: the
 * backend validates against it (warehouseValidator.SUITABLE_FOR) and the
 * dashboard has its own copy. Adding an option means editing all three.
 */
export const SUITABLE_FOR_OPTIONS = [
  { value: 'PHARMA', label: 'Pharma' },
  { value: 'FMCG', label: 'FMCG' },
  { value: 'FNB', label: 'FnB' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'ECOMMERCE', label: 'E-Commerce' },
  { value: 'LOGISTICS', label: 'Logistics' },
  { value: 'TRANSSHIPMENT_COURIER', label: 'Transshipment/Courier' },
  { value: 'FACTORY_INDUSTRIAL', label: 'Factory/Industrial' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'DARK_STORE', label: 'Dark Store' },
];

const LABELS = Object.fromEntries(SUITABLE_FOR_OPTIONS.map((o) => [o.value, o.label]));

/**
 * Label for a stored code. Falls back to the raw value so a tag written by an
 * older or newer client still renders as something, rather than vanishing.
 */
export const suitableForLabel = (value) => LABELS[value] || String(value ?? '');
