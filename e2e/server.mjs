import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const scoutRoot = fileURLToPath(new URL('../', import.meta.url));
const backendRoot = resolve(process.env.E2E_BACKEND_ROOT || join(scoutRoot, '../Backend_Repository'));
const backend = createRequire(join(backendRoot, 'package.json'));

export async function startServer() {
  // Refuse production URLs before loading anything that can create a DB client.
  const baseUrl = backend('./tests/helpers/testDatabaseUrl')(process.env.TEST_DATABASE_URL);
  const schema = `behavior_qa_${randomBytes(8).toString('hex')}`;
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  Object.assign(process.env, {
    NODE_ENV: 'production', DATABASE_URL: url.toString(), DIRECT_URL: url.toString(),
    GUPSHUP_ENABLED: 'false', OPENAI_API_KEY: '', MAPBOX_ACCESS_TOKEN: '',
  });
  // Tests never load the backend's .env or contact notification services.
  backend('dotenv').config = () => ({ parsed: {} });
  const { PrismaClient } = backend('@prisma/client');
  const admin = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const database = backend('./src/utils/database');
  database.prisma = prisma;
  const { createSchema } = backend('./tests/helpers/availabilityReviewDatabase');
  const express = backend('express');
  const WarehouseModel = backend('./src/models/warehouseModel');
  const WarehouseService = backend('./src/services/warehouseService');
  const WarehouseController = backend('./src/controllers/warehouseController');
  const StagedWarehouseModel = backend('./src/models/stagedWarehouseModel');
  const StagingService = backend('./src/services/stagingService');
  const StagingController = backend('./src/controllers/stagingController');
  const SettingsService = backend('./src/services/settingsService');
  const AppSettingModel = backend('./src/models/appSettingModel');
  const Validation = backend('./src/middleware/validation');
  const ErrorHandler = backend('./src/middleware/errorHandler');
  const { verifyScoutToken, clearScoutCache } = backend('./src/middleware/scoutMiddleware');
  const createAuditMiddleware = backend('./src/middleware/auditMiddleware');
  const settings = new SettingsService(new AppSettingModel(prisma));
  const warehouseService = new WarehouseService(new WarehouseModel(prisma));
  const stagingService = new StagingService(new StagedWarehouseModel(prisma), warehouseService, settings);
  const warehouses = new WarehouseController(warehouseService, {}, stagingService);
  const staging = new StagingController(stagingService, {});
  const buildDir = await mkdtemp(join(tmpdir(), 'scout-readiness-build-'));
  const pendingAudits = new Set();
  let server;
  let schemaCreated = false;
  const close = async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await Promise.all(pendingAudits);
    clearScoutCache();
    await prisma.$disconnect();
    if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
    await rm(buildDir, { recursive: true, force: true });
  };
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await createSchema(prisma);
    for (const table of ['Warehouse', 'StagedWarehouse']) {
      // These three columns are @db.Date in the production Prisma schema.
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}"
        ADD COLUMN "availabilityLastReviewedOn" date,
        ALTER COLUMN "handoverDate" TYPE date,
        ALTER COLUMN "lockInDate" TYPE date`);
    }
    await prisma.$executeRawUnsafe(`CREATE TABLE "VerifiedNumber" (
      id serial PRIMARY KEY, phone_number text UNIQUE NOT NULL, name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(),
      twenty_user_id text UNIQUE, email text UNIQUE, "empID" text UNIQUE,
      role text DEFAULT 'EMPLOYEE', "adminAccess" boolean DEFAULT false,
      "analystAccess" boolean DEFAULT false, "callDashboardAccess" boolean DEFAULT false,
      "dashboardAccess" boolean DEFAULT false, "reviewerAccess" boolean DEFAULT false)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE app_setting (
      application text, key text, value jsonb NOT NULL, "updatedBy" text,
      "updatedAt" timestamp NOT NULL DEFAULT now(), PRIMARY KEY(application, key))`);
    await prisma.verifiedNumber.create({ data: {
      phone_number: '9999999999', name: 'E2E scout', email: 'scout@example.test', empID: 'E2ESCOUT',
    } });
    await settings.setAutoApprove(false, 'e2e@example.test');

    const app = express();
    app.use(express.json());
    app.use(createAuditMiddleware({ log: entry => {
      const task = prisma.auditLog.create({ data: {
        ...entry, entityId: entry.entityId == null ? null : String(entry.entityId),
        metadata: entry.metadata ?? undefined,
      } });
      pendingAudits.add(task);
      task.finally(() => pendingAudits.delete(task));
      return task;
    } }));
    // Real Scout authentication, validator, controller, service, and database.
    app.post('/api/warehouses/scout', verifyScoutToken, Validation.validateWarehouseCreate, warehouses.createScoutWarehouse);
    // The reviewer is a fixture identity; Google sign-in and role assignment are outside this suite.
    app.use('/api/staging', (req, _res, next) => {
      req.user = { email: 'reviewer@example.test', name: 'E2E reviewer', isAdmin: true };
      next();
    });
    app.get('/api/staging/:id', staging.getSubmission);
    app.post('/api/staging/:id/approve', staging.approveSubmission);
    app.get('/api/warehouses/:id', warehouses.getWarehouseById);
    app.use('/api', ErrorHandler.handle);
    // Build the actual application. No Vite dev server or intercepted API responses.
    await build({ root: scoutRoot, configFile: false, envDir: buildDir,
      plugins: [react()], logLevel: 'warn',
      define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'process.env.NODE_ENV': JSON.stringify('production') },
      build: { outDir: buildDir, emptyOutDir: false },
    });
    app.use(express.static(buildDir));
    app.get('/', (_req, res) => res.sendFile(join(buildDir, 'index.html')));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    return { url: `http://127.0.0.1:${server.address().port}`, prisma, settings, close };
  } catch (error) {
    await close();
    throw error;
  }
}
