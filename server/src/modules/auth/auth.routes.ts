import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import * as svc from './auth.service';
import { otpRequestSchema, otpVerifySchema, passwordLoginSchema, refreshSchema } from './auth.schema';

export const authRouter = Router();

// 5 codes per phone/email per 10 min (so a demo laptop can switch accounts), plus a looser per-IP cap.
const tooMany = (_req: Request, res: Response) => res.status(429).json({
  success: false, error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Try again in a few minutes.', fieldErrors: [] },
  meta: { requestId: res.locals.requestId },
});
const perIdentifier = rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, handler: tooMany,
  keyGenerator: req => `id:${String(req.body?.email ?? req.body?.phone ?? '').toLowerCase()}` });
const perIp = rateLimit({ windowMs: 10 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, handler: tooMany });

// Sign in OR sign up: { email } or { phone } → code by email or SMS. New accounts are created on verify.
authRouter.post('/auth/otp/request', perIp, perIdentifier, validate({ body: otpRequestSchema }),
  h(async (req, res) => { const r = await svc.requestOtp(req.body); ok(res, { sent: true, ...r }); }));

authRouter.post('/auth/otp/verify', validate({ body: otpVerifySchema }),
  h(async (req, res) => ok(res, await svc.verifyOtp({ phone: req.body.phone, email: req.body.email }, req.body.otp, req.body.fullName, req.body.loginAs))));
// Admins: email + password (rate-limited like OTP: 5 tries per email per 10 min).
authRouter.post('/auth/password/login', perIp, perIdentifier, validate({ body: passwordLoginSchema }),
  h(async (req, res) => ok(res, await svc.passwordLogin(req.body.email, req.body.password))));
authRouter.post('/auth/refresh', validate({ body: refreshSchema }),
  h(async (req, res) => ok(res, await svc.refresh(req.body.refreshToken))));
authRouter.post('/auth/logout', validate({ body: refreshSchema }),
  h(async (req, res) => { await svc.logout(req.body.refreshToken); res.status(204).end(); }));
