import http from 'http';
import bcrypt from 'bcryptjs';
import { config } from './config';
import app from './app';
import { initSocket } from './services/socket.service';
import { startScheduledMessageWorker, startCampaignWorker } from './services/automation.service';
import { prisma } from './lib/prisma';

// ─── Start HTTP server immediately so healthcheck passes ──────────────────────
const server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`\n🚀 Server listening on port ${config.port}`);
  console.log(`📡 Webhook: http://localhost:${config.port}/webhook`);
  console.log(`🌐 Env: ${config.env}\n`);
});

// ─── Async DB setup (non-blocking — server is already up) ────────────────────
async function setup(): Promise<void> {
  // 1. Connect
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ DB connection failed:', err);
    return; // run degraded — server still responds
  }

  // 2. pgvector extension
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector ready');
  } catch {
    console.warn('⚠️  pgvector unavailable — keyword fallback active');
  }

  // 3. Auto-migrate schema
  try {
    const { execSync } = await import('child_process');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('✅ Schema synced');
  } catch (err) {
    console.warn('⚠️  prisma db push failed (may already be up to date):', err);
  }

  // 4. Seed super admin
  try {
    const existing = await prisma.user.findUnique({ where: { email: config.admin.email } });
    if (!existing) {
      const hashed = await bcrypt.hash(config.admin.password, 12);
      await prisma.user.create({
        data: { email: config.admin.email, password: hashed, name: config.admin.name, role: 'SUPER_ADMIN' },
      });
      console.log(`✅ Super admin: ${config.admin.email}`);
    }
  } catch (err) {
    console.warn('⚠️  Admin seed failed:', err);
  }

  // 5. Seed primary organization + number
  if (config.seed.orgName && config.seed.phoneNumberId && config.seed.accessToken) {
    try {
      let org = await prisma.organization.findFirst({ where: { name: config.seed.orgName } });
      if (!org) {
        org = await prisma.organization.create({
          data: {
            name: config.seed.orgName,
            businessType: (config.seed.businessType as never) ?? 'GENERAL',
            specialInstructions: config.seed.specialInstructions,
          },
        });
        console.log(`✅ Org created: ${org.name}`);
      }

      const existingNum = await prisma.whatsAppNumber.findUnique({
        where: { phoneNumberId: config.seed.phoneNumberId },
      });
      if (!existingNum) {
        await prisma.whatsAppNumber.create({
          data: {
            label: 'Primary',
            phoneNumberId: config.seed.phoneNumberId,
            accessToken: config.seed.accessToken,
            wabaId: config.seed.wabaId ?? '',
            isPrimary: true,
            organizationId: org.id,
          },
        });
        console.log(`✅ WA number registered: ${config.seed.phoneNumberId}`);
      }

      const admin = await prisma.user.findUnique({ where: { email: config.admin.email } });
      if (admin && !admin.organizationId) {
        await prisma.user.update({ where: { id: admin.id }, data: { organizationId: org.id } });
      }
    } catch (err) {
      console.warn('⚠️  Org seed failed:', err);
    }
  }

  // 6. Background workers
  startScheduledMessageWorker();
  startCampaignWorker();
  console.log('✅ Workers started');
}

// Run setup in background — don't block the server
void setup();
