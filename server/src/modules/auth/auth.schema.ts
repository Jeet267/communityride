import { z } from 'zod';

export const phone = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter +91 followed by a 10-digit mobile number');
export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);


/** A phone number, an email, or both identify who is signing in. The code goes to every one given. */
const atLeastOne = <T extends { phone?: string; email?: string }>(v: T) => !!v.phone || !!v.email;
const identifierMsg = { message: 'Enter your mobile number or email', path: ['phone'] };

export const otpRequestSchema = z.object({ phone: phone.optional(), email: email.optional() })
  .refine(atLeastOne, identifierMsg);

export const otpVerifySchema = z.object({
  phone: phone.optional(),
  email: email.optional(),
  otp: z.string().regex(/^\d{6}$/, 'The code is 6 digits'),
  fullName: z.string().trim().min(2).max(60).optional(),
  // "Sign in as …" chosen on the login screen; the server decides whether it is allowed.
  loginAs: z.enum(['PASSENGER', 'DRIVER', 'RENTAL_OWNER', 'FLEET_OPERATOR', 'ADMIN']).default('PASSENGER'),
}).refine(atLeastOne, identifierMsg);


export const passwordLoginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(100) });

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
