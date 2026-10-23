import { RequestHandler } from 'express';
import { verifyAccess } from '../utils/jwt';
import { AppError } from '../utils/AppError';

declare global { namespace Express { interface Request { user?: { id: string; roles: string[] } } } }

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.header('authorization')?.replace(/^Bearer /, '');
  if (!token) return next(new AppError('UNAUTHENTICATED', 401, 'Please sign in'));
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, roles: p.roles };
    next();
  } catch {
    next(new AppError('UNAUTHENTICATED', 401, 'Your session has expired'));
  }
};

export const requireRole = (...roles: string[]): RequestHandler => (req, _res, next) =>
  req.user && roles.some(r => req.user!.roles.includes(r))
    ? next()
    : next(new AppError('FORBIDDEN', 403, 'You do not have access to this'));
