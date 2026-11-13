import { AnyZodObject, ZodTypeAny } from 'zod';
import { RequestHandler } from 'express';

export const validate = (s: { body?: ZodTypeAny; query?: ZodTypeAny; params?: AnyZodObject }): RequestHandler =>
  (req, _res, next) => {
    try {
      if (s.body) req.body = s.body.parse(req.body);
      if (s.query) (req as any).query = s.query.parse(req.query);
      if (s.params) req.params = s.params.parse(req.params) as any;
      next();
    } catch (e) { next(e); }
  };
