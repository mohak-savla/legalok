/**
 * Seed runner — demo admin & user + 10 legal templates.
 * Runs automatically on first boot (empty DB) or manually: npm run seed
 */
import bcrypt from 'bcryptjs';
import { AppDataSource } from './connection';
import { User, Template } from './entities';
import { TPL_NDA } from './seed.nda';
import { TPL_RENT } from './seed.rent';
import { TPL_EMPLOYMENT } from './seed.employment';
import { TPL_FREELANCE } from './seed.freelance';
import { TPL_LOAN } from './seed.loan';
import { TPL_POA } from './seed.poa';
import { TPL_PARTNERSHIP } from './seed.partnership';
import { TPL_VEHICLE } from './seed.vehicle';
import { TPL_SLA } from './seed.sla';
import { TPL_CASED } from './seed.cased';

const ALL = [TPL_NDA, TPL_RENT, TPL_EMPLOYMENT, TPL_FREELANCE, TPL_LOAN, TPL_POA, TPL_PARTNERSHIP, TPL_VEHICLE, TPL_SLA, TPL_CASED];

export async function runSeed(): Promise<void> {
  const users = AppDataSource.getRepository(User);
  const tpls = AppDataSource.getRepository(Template);

  let admin = await users.findOne({ where: { email: 'admin@legalok.in' } });
  if (!admin) {
    admin = users.create({
      email: 'admin@legalok.in', fullName: 'Legalok Admin',
      passwordHash: await bcrypt.hash('Admin@123', 10), role: 'admin', emailVerified: true,
    });
    await users.save(admin);
  }
  let demo = await users.findOne({ where: { email: 'demo@legalok.in' } });
  if (!demo) {
    demo = users.create({
      email: 'demo@legalok.in', fullName: 'Demo User',
      passwordHash: await bcrypt.hash('Demo@123', 10), role: 'user', emailVerified: true,
    });
    await users.save(demo);
  }

  for (const def of ALL) {
    const exists = await tpls.findOne({ where: { slug: def.slug } });
    if (exists) continue;
    await tpls.save(tpls.create({ ...def, status: 'published', isActive: true, publishedAt: new Date(), createdBy: admin.id }));
  }
  console.log(`[seed] ${ALL.length} templates ready. Logins: admin@legalok.in/Admin@123 · demo@legalok.in/Demo@123`);
}

// Standalone execution: npm run seed
if (require.main === module) {
  AppDataSource.initialize()
    .then(runSeed)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
