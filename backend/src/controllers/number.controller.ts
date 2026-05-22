import { Response } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../types';

export async function getNumbers(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const numbers = await prisma.whatsAppNumber.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { contacts: true, messages: true } } },
    orderBy: { isPrimary: 'desc' },
  });
  res.json(numbers);
}

export async function addNumber(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const { label, phoneNumberId, accessToken, wabaId, phoneNumber } = req.body as {
    label: string; phoneNumberId: string; accessToken: string; wabaId: string; phoneNumber?: string;
  };

  const existing = await prisma.whatsAppNumber.findFirst({ where: { organizationId: orgId } });
  const isPrimary = !existing;

  const number = await prisma.whatsAppNumber.create({
    data: { label, phoneNumberId, accessToken, wabaId, phoneNumber, organizationId: orgId, isPrimary },
  });

  res.status(201).json(number);
}

export async function updateNumber(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const id = String(req.params['id']);
  const { label, accessToken, isActive } = req.body as { label?: string; accessToken?: string; isActive?: boolean };

  const updated = await prisma.whatsAppNumber.updateMany({
    where: { id, organizationId: orgId },
    data: { label, accessToken, isActive },
  });

  if (updated.count === 0) { res.status(404).json({ error: 'Number not found' }); return; }
  res.json({ message: 'Updated' });
}

export async function setPrimary(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const id = String(req.params['id']);

  await prisma.whatsAppNumber.updateMany({ where: { organizationId: orgId }, data: { isPrimary: false } });
  await prisma.whatsAppNumber.updateMany({ where: { id, organizationId: orgId }, data: { isPrimary: true } });

  res.json({ message: 'Primary number updated' });
}

export async function deleteNumber(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.user!.organizationId!;
  const id = String(req.params['id']);

  const num = await prisma.whatsAppNumber.findFirst({ where: { id, organizationId: orgId } });
  if (!num) { res.status(404).json({ error: 'Not found' }); return; }
  if (num.isPrimary) { res.status(400).json({ error: 'Cannot delete primary number. Set another as primary first.' }); return; }

  await prisma.whatsAppNumber.delete({ where: { id: num.id } });
  res.json({ message: 'Deleted' });
}
