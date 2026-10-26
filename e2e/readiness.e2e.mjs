import { test, expect } from '@playwright/test';
import { startServer } from './server.mjs';

let server;
const draftKey = 'warehouseForm:draft:v1';
const field = (page, key) => page.locator(`[data-field="${key}"]`);
async function pressButton(page, button) {
  if (page.e2eTouch) await button.tap();
  else await button.click();
}
const next = async page => {
  if (page.e2eTouch) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
  await pressButton(page, page.getByRole('button', { name: /^Next$/ }));
};
const day = value => value == null ? null : new Date(`${value}T00:00:00.000Z`);
const required = {
  listing_type: 'Rent', warehouseType: 'PEB', address: 'E2E locality', city: 'New Delhi', state: 'Delhi',
  contactPerson: 'E2E owner', contactNumber: '9999999999', uploadedBy: 'E2ESCOUT',
  compliances: 'CLU and Fire NOC confirmed', totalSpaceSqft: [10000], ratePerSqft: '25',
};

test.beforeAll(async () => {
  test.setTimeout(120_000);
  server = await startServer();
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page, hasTouch }) => {
  page.e2eTouch = hasTouch;
  await server.settings.setAutoApprove(false);
  await page.route('**/*', route => new URL(route.request().url()).origin === server.url
    ? route.continue() : route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.e2eErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.e2eErrors).toEqual([]); });

async function restore(page, values = {}, currentStep = 4) {
  await page.goto(server.url);
  await page.evaluate(({ key, values, currentStep }) => {
    localStorage.setItem(key, JSON.stringify({ currentStep, values }));
  }, { key: draftKey, values: { ...required, ...values }, currentStep });
  await page.reload();
}

async function fillFreshForm(page) {
  await page.goto(server.url);
  await field(page, 'listing_type').selectOption('Rent');
  for (const key of ['contactPerson', 'contactNumber', 'uploadedBy']) await field(page, key).fill(required[key]);
  await next(page);
  await page.getByPlaceholder('Enter locality').fill(required.address);
  await field(page, 'state').fill('Delhi');
  await page.locator('.combobox-option').filter({ hasText: /^Delhi$/ }).click();
  await expect(field(page, 'city')).toHaveValue('New Delhi');
  await next(page);
  await field(page, 'warehouseType').selectOption('PEB');
  await field(page, 'totalSpaceSqft').fill('10000');
  await next(page);
  await page.getByPlaceholder('Please only mention conversion-related and Fire NOC-related status.').fill(required.compliances);
  await next(page);
  await field(page, 'ratePerSqft').fill('25');
}

async function submit(page) {
  while (await page.getByRole('button', { name: /^Next$/ }).isVisible()) await next(page);
  const button = page.getByRole('button', { name: 'Create Warehouse', exact: true });
  await expect(button).toBeEnabled();
  const responsePromise = page.waitForResponse(response => response.url() === `${server.url}/api/warehouses/scout`
    && response.request().method() === 'POST');
  await pressButton(page, button);
  const response = await responsePromise;
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(201);
  await expect(page.getByRole('heading', { name: body.warehouseId ? 'Warehouse submitted' : 'Submitted for review', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBeNull();
  return body;
}

async function verifyStored(request, receipt, expected, autoApproved = false) {
  const id = receipt.submissionId;
  expect(id).toBeTruthy();
  const staged = await server.prisma.stagedWarehouse.findUniqueOrThrow({ where: { id } });
  const dbValues = { ...expected };
  for (const key of ['availabilityLastReviewedOn', 'handoverDate', 'lockInDate']) {
    if (key in dbValues) dbValues[key] = day(dbValues[key]);
  }
  expect(staged).toMatchObject({ ...dbValues, source: 'SCOUT', reviewStatus: autoApproved ? 'APPROVED' : 'PENDING' });
  const stagedResponse = await request.get(`${server.url}/api/staging/${id}`);
  expect(stagedResponse.ok()).toBe(true);
  expect(await stagedResponse.json()).toMatchObject({ id });
  let warehouseId = receipt.warehouseId;
  if (!autoApproved) {
    expect(warehouseId).toBeNull();
    const approved = await request.post(`${server.url}/api/staging/${id}/approve`);
    const body = await approved.json();
    expect(approved.status(), JSON.stringify(body)).toBe(201);
    warehouseId = body.id;
  }
  const approved = await server.prisma.stagedWarehouse.findUniqueOrThrow({ where: { id } });
  expect(approved).toMatchObject({ reviewStatus: 'APPROVED', warehouseId });
  expect(await server.prisma.warehouse.findUniqueOrThrow({ where: { id: warehouseId } })).toMatchObject({
    ...dbValues, visibility: true, wogVerified: false, totalSpaceSqft: [10000],
  });
  expect(await server.prisma.warehouseData.count({ where: { warehouseId } })).toBe(1);
  const saved = await request.get(`${server.url}/api/warehouses/${warehouseId}`);
  expect(saved.ok()).toBe(true);
  const jsonValues = Object.fromEntries(Object.entries(dbValues).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
  expect(await saved.json()).toMatchObject(jsonValues);
  // A retry cannot publish a duplicate master warehouse.
  expect((await request.post(`${server.url}/api/staging/${id}/approve`)).status()).toBe(409);
}

for (const width of [320, 390, 1280]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    test('a fresh Fixed submission persists through real API, PostgreSQL and approval', async ({ page, request }) => {
      await fillFreshForm(page);
      const values = { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10',
        handoverDate: '2027-01-15', lockInDate: '2027-01-01', status: 'Under construction' };
      await field(page, 'availability').selectOption(values.availability);
      for (const key of ['availabilityLastReviewedOn', 'handoverDate', 'lockInDate']) await field(page, key).fill(values[key]);
      await field(page, 'status').selectOption(values.status);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await field(page, 'availability').scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`readiness-${width}.png`), fullPage: true });
      const receipt = await submit(page);
      await verifyStored(request, receipt, { ...values, handoverType: 'FIXED', handoverLeadValue: null, handoverLeadUnit: null });
    });
  });
}

for (const [unit, value] of [['Days', 1], ['Weeks', 2], ['Months', 120]]) {
  test(`Variable ${value} ${unit} survives mode switches, reload and auto-approval`, async ({ page, request }) => {
    await restore(page, { availability: 'No', handoverDate: '2027-02-28', lockInDate: '2027-02-01' });
    await field(page, 'handoverType').selectOption('Variable');
    await field(page, 'handoverLeadValue').fill(String(value));
    await field(page, 'handoverLeadUnit').selectOption(unit);
    await field(page, 'handoverType').selectOption('Fixed');
    await expect(field(page, 'handoverDate')).toHaveValue('2027-02-28');
    await field(page, 'handoverType').selectOption('Variable');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).values.handoverLeadUnit, draftKey)).toBe(unit);
    await page.reload();
    await expect(field(page, 'handoverLeadValue')).toHaveValue(String(value));
    await expect(field(page, 'handoverLeadUnit')).toHaveValue(unit);
    await server.settings.setAutoApprove(true);
    await verifyStored(request, await submit(page), { availability: 'No', availabilityLastReviewedOn: null,
      handoverType: 'VARIABLE', handoverDate: '2027-02-28', handoverLeadValue: value,
      handoverLeadUnit: unit.toUpperCase(), lockInDate: '2027-02-01', status: null }, true);
  });
}

test('availability suggests today and cleared construction status stays cleared after reload and approval', async ({ page, request }) => {
  await restore(page, { availability: ' yes ', availabilityLastReviewedOn: '2025-01-10', status: 'Ready to move' });
  await field(page, 'availability').selectOption('Yes');
  await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('2025-01-10');
  await field(page, 'availability').selectOption('No');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue(today);
  await field(page, 'status').selectOption('');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).values.status, draftKey)).toBe('');
  await page.reload();
  await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue(today);
  await expect(field(page, 'status')).toHaveValue('');
  await verifyStored(request, await submit(page), { availability: 'No', availabilityLastReviewedOn: today, status: null });
});

test('an older draft with all new optional fields absent still submits', async ({ page, request }) => {
  await restore(page);
  await verifyStored(request, await submit(page), { availabilityLastReviewedOn: null, status: null,
    handoverType: 'FIXED', handoverDate: null, handoverLeadValue: null, handoverLeadUnit: null, lockInDate: null });
});

test('invalid lead times and review dates are blocked before any submission request', async ({ page }) => {
  await restore(page);
  const posts = [];
  page.on('request', req => { if (req.method() === 'POST') posts.push(req.url()); });
  await field(page, 'handoverType').selectOption('Variable');
  for (const value of ['0', '-1', '1.5', '121']) {
    await field(page, 'handoverLeadValue').fill(value);
    await next(page);
    await expect(page.getByText('Lead time must be a whole number between 1 and 120', { exact: true })).toBeVisible();
  }
  await field(page, 'handoverLeadValue').fill('2');
  await field(page, 'availabilityLastReviewedOn').fill('2025-01-10');
  await next(page);
  await expect(page.getByText('Select availability before recording a review date', { exact: true })).toBeVisible();
  await field(page, 'availability').selectOption('Yes');
  await field(page, 'availabilityLastReviewedOn').fill('2999-01-01');
  await next(page);
  await expect(page.getByText('Review date cannot be in the future', { exact: true })).toBeVisible();
  expect(posts).toEqual([]);
});

for (const key of ['availabilityLastReviewedOn', 'handoverDate', 'lockInDate', 'handoverLeadValue']) {
  test(`unfinished native ${key} input cannot silently submit as blank`, async ({ page }) => {
    await restore(page, { availability: 'Yes' });
    if (key === 'handoverLeadValue') await field(page, 'handoverType').selectOption('Variable');
    const input = field(page, key);
    await input.focus();
    await input.pressSequentially(key === 'handoverLeadValue' ? 'e' : '10');
    expect(await input.evaluate(node => node.validity.badInput)).toBe(true);
    await next(page);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill(key === 'handoverLeadValue' ? '2' : '2025-01-10');
    await next(page);
    await expect(page.getByRole('heading', { name: 'Media', exact: true })).toBeVisible();
  });
}

test('a restored final-step draft revalidates hidden readiness values', async ({ page }) => {
  await restore(page, { handoverType: 'Fixed', handoverLeadValue: '121' }, 5);
  // Reach the final step in either the six-step release or a checkout with a notes step.
  while (await page.getByRole('button', { name: /^Next$/ }).isVisible()) await next(page);
  await page.getByRole('button', { name: 'Create Warehouse', exact: true }).click();
  await expect(page.getByText('Switch to Variable to correct the lead time (a whole number between 1 and 120)', { exact: true })).toBeVisible();
  await expect(field(page, 'handoverType')).toBeVisible();
});

test('failed Scout authentication preserves the draft and succeeds after correction', async ({ page, request }) => {
  await restore(page, { uploadedBy: 'INVALID', availability: 'Yes', availabilityLastReviewedOn: '2025-01-10' });
  const count = await server.prisma.stagedWarehouse.count();
  while (await page.getByRole('button', { name: /^Next$/ }).isVisible()) await next(page);
  const failed = page.waitForResponse(response => response.url().endsWith('/warehouses/scout'));
  await page.getByRole('button', { name: 'Create Warehouse', exact: true }).click();
  expect((await failed).status()).toBe(401);
  expect(await server.prisma.stagedWarehouse.count()).toBe(count);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).values.availabilityLastReviewedOn, draftKey)).toBe('2025-01-10');
  while (await page.getByRole('button', { name: /^Previous$/ }).isVisible()) await page.getByRole('button', { name: /^Previous$/ }).click();
  await field(page, 'uploadedBy').fill('E2ESCOUT');
  await verifyStored(request, await submit(page), { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10' });
});

test('a database write failure retains every readiness value and can be retried', async ({ page, request }) => {
  const readiness = { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10',
    handoverType: 'Variable', handoverDate: '2027-01-15', handoverLeadValue: '3',
    handoverLeadUnit: 'Weeks', lockInDate: '2027-01-01', status: 'Build to suit' };
  await restore(page, readiness);
  while (await page.getByRole('button', { name: /^Next$/ }).isVisible()) await next(page);
  const count = await server.prisma.stagedWarehouse.count();
  await server.prisma.$executeRawUnsafe(`CREATE FUNCTION reject_scout_fixture() RETURNS trigger LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'fixture_write_failure'; END $$`);
  await server.prisma.$executeRawUnsafe(`CREATE TRIGGER reject_scout_fixture BEFORE INSERT ON "StagedWarehouse"
    FOR EACH ROW EXECUTE FUNCTION reject_scout_fixture()`);
  try {
    const failed = page.waitForResponse(response => response.url().endsWith('/warehouses/scout'));
    await page.getByRole('button', { name: 'Create Warehouse', exact: true }).click();
    expect((await failed).status()).toBe(500);
    expect(await server.prisma.stagedWarehouse.count()).toBe(count);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).values, draftKey)).toMatchObject(readiness);
    await expect(page.getByRole('button', { name: 'Create Warehouse', exact: true })).toBeEnabled();
  } finally {
    await server.prisma.$executeRawUnsafe('DROP TRIGGER reject_scout_fixture ON "StagedWarehouse"');
    await server.prisma.$executeRawUnsafe('DROP FUNCTION reject_scout_fixture()');
  }
  await verifyStored(request, await submit(page), { ...readiness, handoverType: 'VARIABLE',
    handoverLeadValue: 3, handoverLeadUnit: 'WEEKS' });
  expect(await server.prisma.stagedWarehouse.count()).toBe(count + 1);
});

test('the API rejects invalid readiness data even if client validation is bypassed', async ({ request }) => {
  const count = await server.prisma.stagedWarehouse.count();
  for (const invalid of [
    { handoverType: 'VARIABLE', handoverLeadValue: 121 }, { handoverLeadUnit: 'YEARS' },
    { availabilityLastReviewedOn: '2999-01-01' }, { availabilityLastReviewedOn: '2025-02-30' },
    { status: 'Invented status' }, { handoverDate: 'not-a-date' },
  ]) {
    const response = await request.post(`${server.url}/api/warehouses/scout`, {
      data: { ...required, warehouseData: {}, availability: 'Yes', ...invalid },
    });
    const body = await response.json();
    expect(response.status(), JSON.stringify(body)).toBe(400);
    expect(body.details.issues.length).toBeGreaterThan(0);
    expect(body.details.issues.every(issue => Object.hasOwn(invalid, issue.path[0]))).toBe(true);
  }
  expect(await server.prisma.stagedWarehouse.count()).toBe(count);
});

test.describe('adversarial availability', () => {
  const indiaToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const draftValue = (page, key) => page.evaluate(({ draftKey, key }) =>
    JSON.parse(localStorage.getItem(draftKey))?.values[key], { draftKey, key });
  const finishSteps = async page => {
    while (await page.getByRole('button', { name: /^Next$/ }).isVisible()) await next(page);
    const button = page.getByRole('button', { name: 'Create Warehouse', exact: true });
    await expect(button).toBeEnabled();
    return button;
  };
  const isSubmission = response => response.url() === `${server.url}/api/warehouses/scout`
    && response.request().method() === 'POST';

  test.describe('on a narrow touch screen', () => {
    test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });

    test('rapid mode changes preserve both answers through navigation, reload and approval', async ({ page, request }) => {
      await restore(page, { availability: 'No', handoverDate: '2028-02-29', lockInDate: '2028-01-31' });
      await field(page, 'handoverType').selectOption('Variable');
      await field(page, 'handoverLeadValue').fill('120');
      await field(page, 'handoverLeadUnit').selectOption('Days');
      for (let i = 0; i < 6; i++) {
        await field(page, 'handoverType').selectOption('Fixed');
        await expect(field(page, 'handoverDate')).toHaveValue('2028-02-29');
        await field(page, 'handoverType').selectOption('Variable');
        await expect(field(page, 'handoverLeadValue')).toHaveValue('120');
      }
      await next(page);
      await pressButton(page, page.getByRole('button', { name: /^Previous$/ }));
      await expect.poll(() => draftValue(page, 'handoverType')).toBe('Variable');
      await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, draftKey)).toBe(4);
      await page.reload();
      await expect(field(page, 'handoverLeadUnit')).toHaveValue('Days');
      await verifyStored(request, await submit(page), { availability: 'No', handoverType: 'VARIABLE',
        handoverDate: '2028-02-29', handoverLeadValue: 120, handoverLeadUnit: 'DAYS', lockInDate: '2028-01-31' });
    });
  });

  test('a broken hidden fixed date in a final-step draft must be corrected before saving', async ({ page, request }) => {
    await restore(page, { availability: 'Yes', handoverType: 'Variable', handoverDate: '2025-02-30',
      handoverLeadValue: '2', handoverLeadUnit: 'Weeks' }, 5);
    const count = await server.prisma.stagedWarehouse.count();
    await (await finishSteps(page)).click();
    await expect(page.getByText('Switch to Fixed to correct the handover date', { exact: true })).toBeVisible();
    expect(await server.prisma.stagedWarehouse.count()).toBe(count);
    await field(page, 'handoverType').selectOption('Fixed');
    await field(page, 'handoverDate').fill('2028-02-29');
    await field(page, 'handoverType').selectOption('Variable');
    await verifyStored(request, await submit(page), { handoverType: 'VARIABLE', handoverDate: '2028-02-29',
      handoverLeadValue: 2, handoverLeadUnit: 'WEEKS' });
  });

  test('explicitly clearing the review date survives answer changes and reload', async ({ page, request }) => {
    await restore(page, { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10' });
    await field(page, 'availability').selectOption('No');
    await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue(indiaToday());
    await field(page, 'availability').selectOption('Yes');
    await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('2025-01-10');
    await field(page, 'availabilityLastReviewedOn').fill('');
    for (const availability of ['No', 'Yes', 'No']) {
      await field(page, 'availability').selectOption(availability);
      await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('');
    }
    await expect.poll(() => draftValue(page, 'availability')).toBe('No');
    await page.reload();
    await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('');
    await verifyStored(request, await submit(page), { availability: 'No', availabilityLastReviewedOn: null });
  });

  test('a legacy free-text answer is preserved verbatim through submission and approval', async ({ page, request }) => {
    const availability = 'Under construction / Available in August';
    await restore(page, { availability, availabilityLastReviewedOn: '2025-01-10' });
    await expect(field(page, 'availability').locator('option:checked')).toHaveText(`${availability} (current)`);
    await verifyStored(request, await submit(page), { availability, availabilityLastReviewedOn: '2025-01-10' });
  });

  test('discarding a draft resets readiness values and the review-date baseline', async ({ page }) => {
    await restore(page, { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10', handoverType: 'Variable',
      handoverDate: '2028-02-29', handoverLeadValue: '120', handoverLeadUnit: 'Months', status: 'Ready to move' });
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    // Fill the required fields without reloading, so reset state is exercised in this same component.
    await field(page, 'listing_type').selectOption('Rent');
    for (const key of ['contactPerson', 'contactNumber', 'uploadedBy']) await field(page, key).fill(required[key]);
    await next(page);
    await page.getByPlaceholder('Enter locality').fill(required.address);
    await field(page, 'state').fill('Delhi');
    await page.locator('.combobox-option').filter({ hasText: /^Delhi$/ }).click();
    await next(page);
    await field(page, 'warehouseType').selectOption('PEB');
    await next(page);
    await page.getByPlaceholder('Please only mention conversion-related and Fire NOC-related status.').fill(required.compliances);
    await next(page);
    await expect(field(page, 'availability')).toHaveValue('');
    await expect(field(page, 'handoverType')).toHaveValue('Fixed');
    await expect(field(page, 'handoverDate')).toHaveValue('');
    await expect(field(page, 'status')).toHaveValue('');
    await field(page, 'availability').selectOption('No');
    await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('');
    await field(page, 'handoverType').selectOption('Variable');
    await expect(field(page, 'handoverLeadValue')).toHaveValue('');
    await expect(field(page, 'handoverLeadUnit')).toHaveValue('');
  });

  test('changing availability clears an unfinished native date without leaving a hidden error', async ({ page, request }) => {
    await restore(page, { availability: 'Yes' });
    const input = field(page, 'availabilityLastReviewedOn');
    await input.focus();
    await input.pressSequentially('10');
    expect(await input.evaluate(node => node.validity.badInput)).toBe(true);
    await next(page);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await field(page, 'availability').selectOption('No');
    await expect(input).toHaveValue(indiaToday());
    expect(await input.evaluate(node => node.validity.badInput)).toBe(false);
    await verifyStored(request, await submit(page), { availability: 'No', availabilityLastReviewedOn: indiaToday() });
  });

  for (const [label, lead, unit] of [['number only', '2', ''], ['unit only', '', 'Weeks']]) {
    test(`optional Variable ${label} is stored without inventing the missing answer`, async ({ page, request }) => {
      await restore(page, { handoverType: 'Variable', handoverLeadValue: lead, handoverLeadUnit: unit });
      await verifyStored(request, await submit(page), { handoverType: 'VARIABLE',
        handoverLeadValue: lead ? Number(lead) : null, handoverLeadUnit: unit ? unit.toUpperCase() : null });
    });
  }

  test('double-clicking and pressing Enter during a delayed submission create only one record', async ({ page, request }) => {
    await restore(page, { availability: 'No', handoverType: 'Variable', handoverLeadValue: '3', handoverLeadUnit: 'Weeks' });
    const button = await finishSteps(page);
    const count = await server.prisma.stagedWarehouse.count();
    const posts = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const hold = async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts.push(route.request().postDataJSON());
      await gate;
      await route.continue();
    };
    await page.route('**/api/warehouses/scout', hold);
    const responsePromise = page.waitForResponse(isSubmission);
    try {
      await button.click({ clickCount: 2, delay: 25 });
      await expect.poll(() => posts.length).toBe(1);
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await page.keyboard.press('Enter');
      expect(posts).toHaveLength(1);
      expect(await server.prisma.stagedWarehouse.count()).toBe(count);
      await expect(page.getByRole('heading', { name: 'Submitted for review', exact: true })).toHaveCount(0);
    } finally {
      release();
    }
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'Submitted for review', exact: true })).toBeVisible();
    await page.unroute('**/api/warehouses/scout', hold);
    expect(posts).toHaveLength(1);
    expect(await server.prisma.stagedWarehouse.count()).toBe(count + 1);
    await verifyStored(request, await response.json(), { availability: 'No', handoverType: 'VARIABLE',
      handoverLeadValue: 3, handoverLeadUnit: 'WEEKS' });
  });

  test('a disconnected request preserves all answers through reload and retry', async ({ page, request }) => {
    const readiness = { availability: 'Yes', availabilityLastReviewedOn: '2024-02-29',
      handoverType: 'Variable', handoverDate: '2028-02-29', handoverLeadValue: '2', handoverLeadUnit: 'Months',
      lockInDate: '2027-12-31', status: 'Build to suit' };
    await restore(page, readiness);
    const button = await finishSteps(page);
    await expect.poll(() => draftValue(page, 'handoverLeadUnit')).toBe('Months');
    const count = await server.prisma.stagedWarehouse.count();
    await page.route('**/api/warehouses/scout', route => route.abort('internetdisconnected'), { times: 1 });
    const failed = page.waitForEvent('requestfailed', req => req.url().endsWith('/warehouses/scout'));
    await button.click();
    await failed;
    await expect(button).toBeEnabled();
    expect(await server.prisma.stagedWarehouse.count()).toBe(count);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).values, draftKey)).toMatchObject(readiness);
    await page.reload();
    await verifyStored(request, await submit(page), { ...readiness, handoverType: 'VARIABLE',
      handoverLeadValue: 2, handoverLeadUnit: 'MONTHS' });
  });

  for (const [timezoneId, localTime] of [['America/Los_Angeles', '00:15'], ['Pacific/Kiritimati', '23:45']]) {
    test.describe(`with browser timezone ${timezoneId}`, () => {
      test.use({ timezoneId });
      test('the review date follows India at the day boundary and stored dates do not shift', async ({ page, request }) => {
        const today = indiaToday();
        await page.clock.setFixedTime(new Date(`${today}T${localTime}:00+05:30`));
        await restore(page, { availability: 'No', handoverDate: '2028-02-29', lockInDate: '2024-02-29' });
        const browserToday = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date()));
        expect(browserToday).not.toBe(today);
        await field(page, 'availability').selectOption('Yes');
        await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue(today);
        await expect(field(page, 'availabilityLastReviewedOn')).toHaveAttribute('max', today);
        await verifyStored(request, await submit(page), { availability: 'Yes', availabilityLastReviewedOn: today,
          handoverDate: '2028-02-29', lockInDate: '2024-02-29' });
      });
    });
  }

  test('API rejects rollover dates and non-date values without saving or coercing them', async ({ request }) => {
    // A valid control proves the request fixture itself can reach persistence.
    // Otherwise a missing required field could make every negative case pass.
    const control = await request.post(`${server.url}/api/warehouses/scout`, {
      data: { ...required, warehouseData: {}, availability: 'Yes', availabilityLastReviewedOn: '2024-02-29',
        handoverDate: '2028-02-29', lockInDate: '2028-02-29' },
    });
    const receipt = await control.json();
    expect(control.status(), JSON.stringify(receipt)).toBe(201);
    await verifyStored(request, receipt, { availability: 'Yes', availabilityLastReviewedOn: '2024-02-29',
      handoverDate: '2028-02-29', lockInDate: '2028-02-29' });
    const count = await server.prisma.stagedWarehouse.count();
    for (const key of ['availabilityLastReviewedOn', 'handoverDate', 'lockInDate']) {
      for (const value of ['2025-02-29', '2025-02-30', '0000-01-01', false, 0, '']) {
        await test.step(`${key}: ${JSON.stringify(value)}`, async () => {
          const response = await request.post(`${server.url}/api/warehouses/scout`, {
            data: { ...required, warehouseData: {}, availability: 'Yes', [key]: value },
          });
          const body = await response.json();
          expect.soft(response.status(), `${key}=${JSON.stringify(value)}: ${JSON.stringify(body)}`).toBe(400);
          expect.soft(body.details?.issues?.map(issue => issue.path[0])).toContain(key);
        });
      }
    }
    const blankAvailability = await request.post(`${server.url}/api/warehouses/scout`, {
      data: { ...required, warehouseData: {}, availability: '   ', availabilityLastReviewedOn: '2024-02-29' },
    });
    expect.soft(blankAvailability.status()).toBe(400);
    expect(await server.prisma.stagedWarehouse.count()).toBe(count);
  });
});
