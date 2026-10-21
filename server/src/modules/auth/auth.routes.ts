import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import * as svc from './auth.service';
import { otpRequestSchema, otpVerifySchema, refreshSchema } from './auth.schema';

export const authRouter = Router();
// 5 OTP requests per phone per 10 min (keyed by phone, so a demo laptop can switch between accounts),
// plus a looser per-IP cap to stop one client spraying many numbers.
const tooMany = (_req: Request, res: Response) => res.status(429).json({
  success: false, error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Try again in a few minutes.', fieldErrors: [] },
  meta: { requestId: res.locals.requestId },
});
const otpPerPhone = rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => `phone:${String(req.body?.phone ?? '')}`, handler: tooMany });
const otpPerIp = rateLimit({ windowMs: 10 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, handler: tooMany });

authRouter.post('/auth/otp/request', otpPerIp, otpPerPhone, validate({ body: otpRequestSchema }),
  h(async (req, res) => { svc.requestOtp(req.body.phone); ok(res, { sent: true }); }));
authRouter.post('/auth/otp/verify', validate({ body: otpVerifySchema }),
  h(async (req, res) => ok(res, await svc.verifyOtp(req.body.phone, req.body.otp, req.body.fullName))));
authRouter.post('/auth/refresh', validate({ body: refreshSchema }),
  h(async (req, res) => ok(res, await svc.refresh(req.body.refreshToken))));
authRouter.post('/auth/logout', validate({ body: refreshSchema }),
  h(async (req, res) => { await svc.logout(req.body.refreshToken); res.status(204).end(); }));
