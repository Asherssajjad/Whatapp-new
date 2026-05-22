import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../types';

export async function getOrganizations(_req: AuthRequest, res: Response): Promise<void> {
  const orgs = await prisma.organization.findMany({
    include: {
      _count: { select: { contacts: true, whatsappNumbers: true } },
      whatsappNumbers: { where: { isPrimary: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orgs);
}

export async function createOrganization(req: AuthRequest, res: Response): Promise<void> {
  const { name, businessType, websiteUrl, specialInstructions } = req.body as {
    name: string; businessType?: string; websiteUrl?: string; specialInstructions?: string;
  };

  const org = await prisma.organization.create({
    data: { name, businessType: businessType as never, websiteUrl, specialInstructions },
  });

  res.status(201).json(org);
}

export async function updateOrganization(req: AuthRequest, res: Response): Promise<void> {
  const id = String(req.params['id']);
  const { name, businessType, websiteUrl, specialInstructions, messageLimit } = req.body as {
    name?: string; businessType?: string; websiteUrl?: string;
    specialInstructions?: string; messageLimit?: number;
  };

  const org = await prisma.organization.update({
    where: { id },
    data: { name, ...(businessType && { businessType: businessType as never }), websiteUrl, specialInstructions, messageLimit },
  });

  res.json(org);
}

export async function deleteOrganization(req: AuthRequest, res: Response): Promise<void> {
  const id = String(req.params['id']);
  await prisma.organization.delete({ where: { id } });
  res.json({ message: 'Organization deleted' });
}

export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  const organizationId = req.query['organizationId'] ? String(req.query['organizationId']) : undefined;

  const users = await prisma.user.findMany({
    where: organizationId ? { organizationId } : undefined,
    omit: { password: true },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(users);
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const { email, password, name, role, organizationId } = req.body as {
    email: string; password: string; name: string; role?: string; organizationId?: string;
  };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { res.status(409).json({ error: 'Email already exists' }); return; }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashed, name, role: role as never ?? 'AGENT', organizationId },
    omit: { password: true },
  });

  res.status(201).json(user);
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  const id = String(req.params['id']);
  await prisma.user.delete({ where: { id } });
  res.json({ message: 'User deleted' });
}

export async function getSystemStats(_req: AuthRequest, res: Response): Promise<void> {
  const [orgs, users, contacts, messages] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.contact.count(),
    prisma.message.count(),
  ]);

  res.json({ organizations: orgs, users, contacts, totalMessages: messages });
}
