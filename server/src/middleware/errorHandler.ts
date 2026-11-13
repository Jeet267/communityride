import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const meta = { requestId: res.locals.requestId };
  const fail = (status: number, code: string, message: string, extra: object = {}) =>
    res.status(status).json({ success: false, meta, error: { code, message, ...extra } });

  if (err instanceof ZodError) return fail(400, 'VALIDATION_ERROR', err.issues[0]?.message ?? 'Some fields are invalid',
    { fieldErrors: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  if (err instanceof AppError) return fail(err.status, err.code, err.message, { details: err.details });
  if (err instanceof multer.MulterError) return fail(400, 'VALIDATION_ERROR', 'File must be under 5 MB');
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
    return fail(409, 'CONFLICT', 'This already exists');
  if (err?.type === 'entity.parse.failed') return fail(400, 'VALIDATION_ERROR', 'Request body is not valid JSON');
  if (String(err?.message ?? '').includes('no_overlap'))
    return fail(409, 'VEHICLE_UNAVAILABLE', 'This vehicle or driver is already booked for that time');
  logger.error({ err, requestId: meta.requestId });
  return fail(500, 'INTERNAL', 'Something went wrong');
};
