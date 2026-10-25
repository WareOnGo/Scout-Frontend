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
      for (const key of ['availability', 'availabilityLastReviewedOn', 'handoverDate', 'lockInDate']) await field(page, key).fill(values[key]);
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

test('a changed availability and cleared construction status stay cleared after reload and approval', async ({ page, request }) => {
  await restore(page, { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10', status: 'Ready to move' });
  await field(page, 'availability').fill(' yes ');
  await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('2025-01-10');
  await field(page, 'availability').fill('No');
  await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('');
  await field(page, 'status').selectOption('');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).values.status, draftKey)).toBe('');
  await page.reload();
  await expect(field(page, 'availabilityLastReviewedOn')).toHaveValue('');
  await expect(field(page, 'status')).toHaveValue('');
  await verifyStored(request, await submit(page), { availability: 'No', availabilityLastReviewedOn: null, status: null });
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
  await expect(page.getByText('Enter availability before recording a review date', { exact: true })).toBeVisible();
  await field(page, 'availability').fill('Yes');
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
    const response = await request.post(`${server.url}/api/warehouses/scout`, { data: { ...required, availability: 'Yes', ...invalid } });
    expect(response.status(), JSON.stringify(await response.json())).toBe(400);
  }
  expect(await server.prisma.stagedWarehouse.count()).toBe(count);
});
