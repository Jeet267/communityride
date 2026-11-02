import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';

export type Db = PrismaClient | Prisma.TransactionClient;

/** Notification rows are written inside the same transaction as the change (outbox style). */
export const notify = (userId: string, type: string, payload: Record<string, unknown>, db: Db = prisma) =>
  db.notification.create({ data: { userId, type, payload: payload as Prisma.InputJsonValue } });
