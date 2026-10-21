import { z } from 'zod';

export const phone = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter +91 followed by a 10-digit mobile number');
export const otpRequestSchema = z.object({ phone });
export const otpVerifySchema = z.object({ phone, otp: z.string().length(6), fullName: z.string().min(2).max(60).optional() });
export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
