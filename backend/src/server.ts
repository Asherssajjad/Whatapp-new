import http from 'http';
import bcrypt from 'bcryptjs';
import { config } from './config';
import app from './app';
import { initSocket } from './services/socket.service';
import { startScheduledMessageWorker, startCampaignWorker } from './services/automation.service';
import { prisma } from './lib/prisma';

async function bootstrap(): Promise<void> {
  // ─── Database Setup ──────────────────────────────────────────────────────────
  console.log('🔌 Connecting to database...');
  await prisma.$connect();

  // Try to enable pgvector extension
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector extension ready');
  } catch {
    console.warn('⚠️  pgvector unavailable — semantic search will use keyword fallback');
  }

  // ─── Seed Super Admin ────────────────────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { email: config.admin.email } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(config.admin.password, 12);
    await prisma.user.create({
      data: { email: config.admin.email, password: hashed, name: config.admin.name, role: 'SUPER_ADMIN' },
    });
    console.log(`✅ Super admin created: ${config.admin.email}`);
  }

  // ─── Seed Primary Organization (from ENV) ────────────────────────────────────
  if (config.seed.orgName && config.seed.phoneNumberId && config.seed.accessToken) {
    let org = await prisma.organization.findFirst({ where: { name: config.seed.orgName } });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: config.seed.orgName,
          businessType: (config.seed.businessType as never) ?? 'GENERAL',
          specialInstructions: config.seed.specialInstructions,
        },
      });
      console.log(`✅ Organization created: ${org.name}`);
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
      console.log(`✅ WhatsApp number registered: ${config.seed.phoneNumberId}`);
    }

    // Assign admin to this org if they don't have one
    const admin = await prisma.user.findUnique({ where: { email: config.admin.email } });
    if (admin && !admin.organizationId) {
      await prisma.user.update({ where: { id: admin.id }, data: { organizationId: org.id } });
    }
  }

  // ─── HTTP + Socket.io ────────────────────────────────────────────────────────
  const server = http.createServer(app);
  initSocket(server);

  // ─── Background Workers ──────────────────────────────────────────────────────
  startScheduledMessageWorker();
  startCampaignWorker();
  console.log('✅ Background workers started');

  server.listen(config.port, () => {
    console.log(`\n🚀 Server running on http://localhost:${config.port}`);
    console.log(`📡 Webhook URL: http://localhost:${config.port}/webhook`);
    console.log(`🌐 Environment: ${config.env}\n`);
  });
}

bootstrap().catch(err => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});
