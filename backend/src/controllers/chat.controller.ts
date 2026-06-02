import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { createWAService } from '../services/whatsapp.service';
import { getIO } from '../services/socket.service';
import type { AuthRequest } from '../types';

export async function getContacts(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { search, status, isHotLead, aiEnabled, page = '1', limit = '50', sortBy = 'lastMessageAt', sortOrder = 'desc' } = req.query;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (search) {
    where['OR'] = [
      { phone: { contains: String(search) } },
      { name: { contains: String(search), mode: 'insensitive' } },
    ];
  }
  if (status) where['status'] = String(status);
  if (isHotLead !== undefined) where['isHotLead'] = isHotLead === 'true';
  if (aiEnabled !== undefined) where['aiEnabled'] = aiEnabled === 'true';

  const take = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * take;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      orderBy: { [String(sortBy)]: sortOrder as 'asc' | 'desc' },
      take,
      skip,
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({ data: contacts, total, page: Number(page), limit: take, hasMore: skip + take < total });
}

export async function getContact(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const phone = String(req.params['phone']);
  const contact = await prisma.contact.findUnique({
    where: { phone_organizationId: { phone, organizationId: orgId } },
    include: {
      tags: { include: { tag: true } },
      conversations: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }
  res.json(contact);
}

export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const phone = String(req.params['phone']);
  const { page = '1', limit = '50' } = req.query;

  const conversation = await prisma.conversation.findFirst({
    where: { phone, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) { res.json({ data: [], total: 0, page: 1, limit: 50, hasMore: false }); return; }

  const take = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * take;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    }),
    prisma.message.count({ where: { conversationId: conversation.id } }),
  ]);

  res.json({ data: messages, total, page: Number(page), limit: take, hasMore: skip + take < total });
}

export async function sendManualMessage(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { phone, message } = req.body as { phone: string; message: string };

  if (!phone || !message) { res.status(400).json({ error: 'phone and message required' }); return; }

  const contact = await prisma.contact.findUnique({
    where: { phone_organizationId: { phone, organizationId: orgId } },
  });
  if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }

  const waNumber = await prisma.whatsAppNumber.findFirst({
    where: { organizationId: orgId, isActive: true, isPrimary: true },
  });
  if (!waNumber) { res.status(400).json({ error: 'No active WhatsApp number' }); return; }

  const wa = createWAService(waNumber);
  await wa.sendText({ to: phone, body: message });

  await prisma.contact.update({
    where: { id: contact.id },
    data: { aiEnabled: false, lastMessageText: message.slice(0, 255), lastMessageAt: new Date() },
  });

  const conversation = await prisma.conversation.findFirst({
    where: { phone, organizationId: orgId, isOpen: true },
    orderBy: { createdAt: 'desc' },
  });

  const savedMessage = await prisma.message.create({
    data: {
      phone,
      content: message,
      type: 'TEXT',
      direction: 'OUTBOUND',
      status: 'SENT',
      isFromBot: false,
      conversationId: conversation!.id,
      whatsappNumberId: waNumber.id,
      sentById: req.user!.userId,
    },
  });

  getIO().to(orgId).emit('new:message', {
    message: {
      id: savedMessage.id,
      phone,
      content: message,
      direction: 'OUTBOUND',
      type: 'TEXT',
      isFromBot: false,
      createdAt: savedMessage.createdAt.toISOString(),
    },
    contact: {
      phone,
      name: contact.name,
      leadScore: contact.leadScore,
      isHotLead: contact.isHotLead,
      status: contact.status,
      lastMessageText: message.slice(0, 255),
      lastMessageAt: new Date().toISOString(),
    },
  });

  res.json(savedMessage);
}

export async function toggleAI(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const phone = String(req.params['phone']);

  const contact = await prisma.contact.findUnique({
    where: { phone_organizationId: { phone, organizationId: orgId } },
  });
  if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: { aiEnabled: !contact.aiEnabled },
  });

  getIO().to(orgId).emit('contact:updated', { phone, organizationId: orgId, changes: { aiEnabled: updated.aiEnabled } });
  res.json({ aiEnabled: updated.aiEnabled });
}

export async function deleteContact(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const phone = String(req.params['phone']);

  await prisma.contact.delete({
    where: { phone_organizationId: { phone, organizationId: orgId } },
  });

  getIO().to(orgId).emit('contact:deleted', { phone, organizationId: orgId });
  res.json({ message: 'Contact deleted' });
}

export async function updateContact(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const phone = String(req.params['phone']);
  const { name, notes, status, email } = req.body as {
    name?: string; notes?: string; status?: string; email?: string;
  };

  const updated = await prisma.contact.update({
    where: { phone_organizationId: { phone, organizationId: orgId } },
    data: { name, notes, email, ...(status && { status: status as never }) },
  });

  res.json(updated);
}

export async function getAnalytics(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 86400000);
  const last30 = new Date(now.getTime() - 30 * 86400000);

  const [
    totalContacts, hotLeads, escalations, aiDisabled,
    msgLast7, msgLast30,
    apptToday,
    tags,
    msgByDay,
    contactGrowth,
  ] = await Promise.all([
    prisma.contact.count({ where: { organizationId: orgId } }),
    prisma.contact.count({ where: { organizationId: orgId, isHotLead: true } }),
    prisma.contact.count({ where: { organizationId: orgId, isEscalated: true } }),
    prisma.contact.count({ where: { organizationId: orgId, aiEnabled: false } }),
    prisma.message.count({
      where: { conversation: { organizationId: orgId }, createdAt: { gte: last7 } },
    }),
    prisma.message.count({
      where: { conversation: { organizationId: orgId }, createdAt: { gte: last30 } },
    }),
    prisma.appointment.count({
      where: {
        organizationId: orgId,
        dateTime: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
    }),
    prisma.tag.findMany({
      where: { organizationId: orgId },
      include: { contacts: true },
      orderBy: { contacts: { _count: 'desc' } },
      take: 5,
    }),
    prisma.message.groupBy({
      by: ['direction'],
      where: { conversation: { organizationId: orgId }, createdAt: { gte: last7 } },
      _count: true,
    }),
    prisma.contact.groupBy({
      by: ['createdAt'],
      where: { organizationId: orgId, createdAt: { gte: last30 } },
      _count: true,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  res.json({
    totalContacts,
    hotLeads,
    escalations,
    aiDisabledContacts: aiDisabled,
    messagesLast7Days: msgLast7,
    messagesLast30Days: msgLast30,
    appointmentsToday: apptToday,
    topTagsByContact: tags.map(t => ({ name: t.name, count: t.contacts.length, color: t.color })),
    messageDirectionBreakdown: msgByDay,
    contactGrowth: contactGrowth.slice(-30),
  });
}

export async function getHandoffs(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId, isEscalated: true },
    orderBy: { escalatedAt: 'desc' },
  });
  res.json(contacts);
}

export async function getOrders(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { status, page = '1', limit = '50' } = req.query;
  const take = Math.min(Number(limit), 100);
  const skip = (Number(page) - 1) * take;

  const where = { organizationId: orgId, ...(status && { status: String(status) as never }) };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.order.count({ where }),
  ]);
  res.json({ data: orders, total, page: Number(page), limit: take, hasMore: skip + take < total });
}

export async function updateOrder(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { id } = req.params as { id: string };
  const { status, notes } = req.body as { status?: string; notes?: string };

  const order = await prisma.order.updateMany({
    where: { id, organizationId: orgId },
    data: { ...(status && { status: status as never }), ...(notes !== undefined && { notes }) },
  });
  if (order.count === 0) { res.status(404).json({ error: 'Order not found' }); return; }
  res.json({ message: 'Order updated' });
}

export async function deleteOrder(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { id } = req.params as { id: string };
  await prisma.order.deleteMany({ where: { id, organizationId: orgId } });
  res.json({ message: 'Order deleted' });
}
