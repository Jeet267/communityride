import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../middleware/auth';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', authenticate, h(async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  ok(res, { items, unread });
}));
notificationsRouter.patch('/notifications/:id/read', authenticate, h(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { readAt: new Date() } });
  ok(res, { read: true });
}));
notificationsRouter.post('/notifications/read-all', authenticate, h(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  ok(res, { read: true });
}));
