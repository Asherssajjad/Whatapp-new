import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { createWAService } from './whatsapp.service';
import { getIO } from './socket.service';
import type { AutomationAction } from '../types';

// ─── Scheduled Messages ────────────────────────────────────────────────────────

export function startScheduledMessageWorker(): void {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const pending = await prisma.scheduledMessage.findMany({
        where: { isSent: false, failed: false, scheduledAt: { lte: now } },
        take: 50,
      });

      for (const msg of pending) {
        try {
          // Find active WhatsApp number (any org's primary number — in a real scenario, store org on ScheduledMessage)
          const number = await prisma.whatsAppNumber.findFirst({ where: { isActive: true, isPrimary: true } });
          if (!number) continue;

          const wa = createWAService(number);
          await wa.sendText({ to: msg.phone, body: msg.message });

          await prisma.scheduledMessage.update({
            where: { id: msg.id },
            data: { isSent: true, sentAt: new Date() },
          });
        } catch (err) {
          await prisma.scheduledMessage.update({
            where: { id: msg.id },
            data: { failed: true, error: String(err) },
          });
        }
      }
    } catch (err) {
      console.error('[Automation] Scheduled message worker error:', err);
    }
  });
}

// ─── Campaign Sender ───────────────────────────────────────────────────────────

export function startCampaignWorker(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now },
        },
        include: { organization: { include: { whatsappNumbers: { where: { isPrimary: true, isActive: true } } } } },
      });

      for (const campaign of campaigns) {
        await runCampaign(campaign.id);
      }
    } catch (err) {
      console.error('[Automation] Campaign worker error:', err);
    }
  });
}

export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      organization: {
        include: { whatsappNumbers: { where: { isPrimary: true, isActive: true } } },
      },
    },
  });

  if (!campaign) return;
  if (campaign.status === 'RUNNING') return; // already running

  const primaryNumber = campaign.organization.whatsappNumbers[0];
  if (!primaryNumber) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'CANCELLED' } });
    return;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'RUNNING' },
  });

  const filters = (campaign.filters as Record<string, unknown>) ?? {};
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: campaign.organizationId,
      optedOut: false,
      status: 'ACTIVE',
      ...(filters['tags'] && {
        tags: { some: { tag: { name: { in: filters['tags'] as string[] } } } },
      }),
    },
    take: 1000,
  });

  const wa = createWAService(primaryNumber);
  let sent = 0;
  let failed = 0;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalContacts: contacts.length },
  });

  for (const contact of contacts) {
    try {
      await wa.sendText({ to: contact.phone, body: campaign.message });
      sent++;
      await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: sent } });
      getIO().to(campaign.organizationId).emit('campaign:progress', {
        campaignId,
        sent,
        total: contacts.length,
      });
      // Rate limit: ~40 msg/min
      await sleep(1500);
    } catch {
      failed++;
      await prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: failed } });
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', sentAt: new Date(), sentCount: sent, failedCount: failed },
  });
}

// ─── Automation Trigger Runner ─────────────────────────────────────────────────

export async function runAutomations(
  trigger: string,
  organizationId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({
      where: { organizationId, trigger: trigger as never, isActive: true },
    });

    for (const automation of automations) {
      try {
        const actions = automation.actions as AutomationAction[];
        await executeActions(actions, organizationId, data);
        await prisma.automation.update({
          where: { id: automation.id },
          data: { runCount: { increment: 1 } },
        });
      } catch (err) {
        console.error(`[Automation] Failed to run automation ${automation.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Automation] runAutomations error:', err);
  }
}

async function executeActions(
  actions: AutomationAction[],
  organizationId: string,
  data: Record<string, unknown>
): Promise<void> {
  const contactPhone = data['phone'] as string | undefined;

  for (const action of actions) {
    switch (action.type) {
      case 'SEND_MESSAGE': {
        if (!contactPhone) break;
        const number = await prisma.whatsAppNumber.findFirst({
          where: { organizationId, isActive: true, isPrimary: true },
        });
        if (!number) break;
        const wa = createWAService(number);
        await wa.sendText({ to: contactPhone, body: String(action.data['message'] ?? '') });
        break;
      }

      case 'SET_TAG': {
        if (!contactPhone) break;
        const tag = await prisma.tag.findFirst({
          where: { organizationId, name: String(action.data['tagName'] ?? '') },
        });
        if (!tag) break;
        const contact = await prisma.contact.findUnique({
          where: { phone_organizationId: { phone: contactPhone, organizationId } },
        });
        if (!contact) break;
        await prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
          create: { contactId: contact.id, tagId: tag.id },
          update: {},
        });
        break;
      }

      case 'UPDATE_LEAD_SCORE': {
        if (!contactPhone) break;
        await prisma.contact.update({
          where: { phone_organizationId: { phone: contactPhone, organizationId } },
          data: { leadScore: { increment: Number(action.data['delta'] ?? 0) } },
        });
        break;
      }

      case 'DISABLE_AI': {
        if (!contactPhone) break;
        await prisma.contact.update({
          where: { phone_organizationId: { phone: contactPhone, organizationId } },
          data: { aiEnabled: false },
        });
        break;
      }

      case 'ENABLE_AI': {
        if (!contactPhone) break;
        await prisma.contact.update({
          where: { phone_organizationId: { phone: contactPhone, organizationId } },
          data: { aiEnabled: true },
        });
        break;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
