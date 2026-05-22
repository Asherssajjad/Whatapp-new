import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import type { AuthRequest } from '../types';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, organizationId: user.organizationId, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as never }
  );

  const refreshToken = uuidv4();
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + config.jwt.refreshExpiresIn),
    },
  });

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      avatar: user.avatar,
    },
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: rt } = req.body as { refreshToken: string };
  if (!rt) { res.status(400).json({ error: 'Refresh token required' }); return; }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: rt },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const newToken = jwt.sign(
    { userId: stored.user.id, organizationId: stored.user.organizationId, role: stored.user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as never }
  );

  res.json({ token: newToken });
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { organization: { include: { whatsappNumbers: true } } },
    omit: { password: true },
  });

  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) { res.status(400).json({ error: 'Current password incorrect' }); return; }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  res.json({ message: 'Password changed successfully' });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken: rt } = req.body as { refreshToken?: string };
  if (rt) {
    await prisma.refreshToken.deleteMany({ where: { token: rt } }).catch(() => null);
  }
  res.json({ message: 'Logged out' });
}
