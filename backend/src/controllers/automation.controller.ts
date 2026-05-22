import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { runCampaign } from '../services/automation.service';
import type { AuthRequest } from '../types';

// ─── Automations ───────────────────────────────────────────────────────────────

export async function getAutomations(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const automations = await prisma.automation.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(automations);
}

export async function createAutomation(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { name, description, trigger, triggerData, actions } = req.body as {
    name: string; description?: string; trigger: string;
    triggerData?: Record<string, unknown>; actions: unknown[];
  };

  const automation = await prisma.automation.create({
    data: { name, description, trigger: trigger as never, triggerData, actions, organizationId: orgId },
  });

  res.status(201).json(automation);
}

export async function updateAutomation(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { name, description, trigger, triggerData, actions, isActive } = req.body as {
    name?: string; description?: string; trigger?: string;
    triggerData?: Record<string, unknown>; actions?: unknown[]; isActive?: boolean;
  };

  const updated = await prisma.automation.updateMany({
    where: { id: req.params['id']!, organizationId: orgId },
    data: { name, description, ...(trigger && { trigger: trigger as never }), triggerData, actions, isActive },
  });

  if (updated.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ message: 'Updated' });
}

export async function deleteAutomation(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  await prisma.automation.deleteMany({ where: { id: req.params['id']!, organizationId: orgId } });
  res.json({ message: 'Deleted' });
}

// ─── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(campaigns);
}

export async function createCampaign(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { name, message, scheduledAt, filters } = req.body as {
    name: string; message: string; scheduledAt?: string; filters?: Record<string, unknown>;
  };

  const campaign = await prisma.campaign.create({
    data: {
      name,
      message,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      filters,
      organizationId: orgId,
    },
  });

  res.status(201).json(campaign);
}

export async function launchCampaign(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params['id']!, organizationId: orgId } });
  if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
  if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
    res.status(400).json({ error: 'Campaign cannot be launched in current state' });
    return;
  }

  // Run in background
  void runCampaign(campaign.id);
  res.json({ message: 'Campaign launched' });
}

export async function deleteCampaign(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  await prisma.campaign.deleteMany({ where: { id: req.params['id']!, organizationId: orgId } });
  res.json({ message: 'Deleted' });
}

// ─── Scheduled Messages ────────────────────────────────────────────────────────

export async function scheduleMessage(req: AuthRequest, res: Response): Promise<void> {
  const { phone, message, scheduledAt } = req.body as { phone: string; message: string; scheduledAt: string };

  const msg = await prisma.scheduledMessage.create({
    data: { phone, message, scheduledAt: new Date(scheduledAt) },
  });

  res.status(201).json(msg);
}

// ─── Agents ────────────────────────────────────────────────────────────────────

export async function getAgents(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const agents = await prisma.agent.findMany({ where: { organizationId: orgId } });
  res.json(agents);
}

export async function addAgent(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { name, phone } = req.body as { name: string; phone: string };

  const agent = await prisma.agent.create({ data: { name, phone, organizationId: orgId } });
  res.status(201).json(agent);
}

export async function updateAgent(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { name, phone, isAvailable } = req.body as { name?: string; phone?: string; isAvailable?: boolean };

  await prisma.agent.updateMany({
    where: { id: req.params['id']!, organizationId: orgId },
    data: { name, phone, isAvailable },
  });

  res.json({ message: 'Updated' });
}

export async function deleteAgent(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  await prisma.agent.deleteMany({ where: { id: req.params['id']!, organizationId: orgId } });
  res.json({ message: 'Deleted' });
}
