import http from 'http';
import bcrypt from 'bcryptjs';
import { config } from './config';
import app from './app';
import { initSocket } from './services/socket.service';
import { startScheduledMessageWorker, startCampaignWorker } from './services/automation.service';
import { prisma } from './lib/prisma';

async function bootstrap(): Promise<void> {
  // 1. Connect to database
  if (config.database.url) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected');
    } catch (err) {
      console.error('❌ DB connection failed:', err);
      // continue — server still needs to start
    }

    // 2. pgvector extension (non-blocking, best-effort)
    try {
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('✅ pgvector ready');
    } catch {
      console.warn('⚠️  pgvector unavailable — keyword search fallback active');
    }

    // 3. Seed super admin — upsert so env var changes always take effect
    try {
      const hashed = await bcrypt.hash(config.admin.password, 12);
      await prisma.user.upsert({
        where: { email: config.admin.email },
        update: { password: hashed, name: config.admin.name },
        create: { email: config.admin.email, password: hashed, name: config.admin.name, role: 'SUPER_ADMIN' },
      });
      console.log(`✅ Super admin ready: ${config.admin.email}`);
    } catch (err) {
      console.warn('⚠️  Admin seed failed:', err);
    }

    // 3b. Trim any whitespace from phoneNumberId values (env var copy-paste artifact)
    await prisma.$executeRaw`UPDATE "WhatsAppNumber" SET "phoneNumberId" = TRIM("phoneNumberId") WHERE "phoneNumberId" != TRIM("phoneNumberId")`.catch(() => null);

    // 4. Seed primary organization — always use existing WA number's org if it exists
    if (config.seed.phoneNumberId && config.seed.accessToken) {
      try {
        // Check if number already exists — if so, use its org (avoids creating duplicate orgs)
        const existingNum = await prisma.whatsAppNumber.findUnique({
          where: { phoneNumberId: config.seed.phoneNumberId.trim() },
          include: { organization: true },
        });

        let org = existingNum?.organization ?? null;

        if (!org) {
          // Only create new org if number doesn't exist yet
          const orgName = config.seed.orgName ?? 'My Business';
          org = await prisma.organization.findFirst({ where: { name: orgName } }) ??
            await prisma.organization.create({
              data: {
                name: orgName,
                businessType: (config.seed.businessType as never) ?? 'GENERAL',
                specialInstructions: config.seed.specialInstructions,
              },
            });
          console.log(`✅ Org ready: ${org.name}`);

          await prisma.whatsAppNumber.create({
            data: {
              label: 'Primary',
              phoneNumberId: config.seed.phoneNumberId.trim(),
              accessToken: config.seed.accessToken.trim(),
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
  } else {
    console.warn('⚠️  DATABASE_URL not set — running without database');
  }

  // 5. Start background workers
  startScheduledMessageWorker();
  startCampaignWorker();

  // 6. Start HTTP server
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`\n🚀 Server on port ${config.port} | env: ${config.env}`);
    console.log(`📡 Webhook: http://localhost:${config.port}/webhook\n`);
  });
}

bootstrap().catch(err => {
  console.error('❌ Startup error:', err);
  process.exit(1);
});
