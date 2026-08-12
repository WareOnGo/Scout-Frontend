// Water supply on site is stored as the WaterSupply enum in the Prisma schema. It
// replaced a hasBorewell boolean, since dropped: true rows were backfilled to BOREWELL,
// while false rows were left null, because "no borewell" never said anything about
// pipeline or tanker supply. So expect plenty of nulls, and note that NONE means
// genuinely no supply on site — an unanswered field stays empty rather than reading
// as 'None'.
//
// Shared so the form and the details modal can't drift apart on wording.

/** Dropdown labels, in the order they should appear. */
export const WATER_SUPPLY_OPTIONS = ['None', 'Borewell', 'Pipeline', 'Tanker', 'Others'];

export const waterSupplyToEnum = (label) => (label ? String(label).toUpperCase() : null);

/** Enum -> dropdown label. Null (unanswered) reads as empty, not 'None'. */
export const waterSupplyToLabel = (value) =>
  (value ? String(value).charAt(0) + String(value).slice(1).toLowerCase() : '');
