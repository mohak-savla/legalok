import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initDb, repo } from './db/connection';
import { Template } from './db/entities';
import { runSeed } from './db/seed';
import { runExpiryJob } from './services/document.service';

import { authRouter } from './modules/auth/auth.routes';
import { authProfileRouter } from './modules/auth/auth.profile.routes';
import { templatesRouter } from './modules/templates/templates.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { documentLifecycleRouter } from './modules/documents/documents.lifecycle.routes';
import { documentEmailRouter } from './modules/documents/documents.email.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { signingRequestRouter } from './modules/signing/signing.request.routes';
import { selfSignRouter } from './modules/signing/signing.selfsign.routes';
import { signGuestRouter } from './modules/signing/signing.guest.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { adminTemplatesRouter } from './modules/admin/admin.templates.routes';
import { adminTemplateWorkflowRouter } from './modules/admin/admin.templates.workflow.routes';
import { adminEmailsRouter } from './modules/admin/admin.emails.routes';

import { miscRouter } from './modules/misc/misc.routes';

async function main(): Promise<void> {
  await initDb();

  // Turnkey first run: seed demo data when the DB is empty
  const templateCount = await repo(Template).count();
  if (templateCount === 0) {
    console.log('[seed] empty database — seeding demo templates & users…');
    await runSeed();
  }

  const app = express();
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'legalok-api', time: new Date().toISOString() }));

  app.use('/api/auth', authRouter);
  app.use('/api/auth', authProfileRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/documents', documentEmailRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/documents', documentLifecycleRouter);
  app.use('/api/documents', signingRequestRouter);
  app.use('/api/documents', selfSignRouter);
  app.use('/api/sign', signGuestRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin/templates', adminTemplatesRouter);
  app.use('/api/admin/templates', adminTemplateWorkflowRouter);
  app.use('/api/admin/emails', adminEmailsRouter);

  app.use('/api/admin', adminRouter);
  app.use('/api', miscRouter);

  app.use('/uploads', express.static(path.join(config.dataDir, 'uploads')));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

  // Serve the built client (production mode)
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Central error handler
  app.use((err: { status?: number; message?: string } & Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status || 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ error: err?.message || 'Internal server error' });
  });

  // Document/token expiry — boot + every 6 hours
  await runExpiryJob();
  setInterval(() => {
    runExpiryJob().catch((e) => console.error('[expiry]', e));
  }, 6 * 60 * 60 * 1000);

  app.listen(config.port, () => {
    console.log(`[legalok] API ready on http://localhost:${config.port} (${config.nodeEnv}, db: ${config.dbType})`);
  });
}

main().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});
