import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, res, next) => {
  res.locals.requestId = req.header('x-request-id') ?? `req_${randomUUID()}`;
  res.setHeader('x-request-id', res.locals.requestId);
  next();
};
