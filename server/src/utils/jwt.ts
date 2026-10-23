import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type AccessPayload = { sub: string; roles: string[] };
export const signAccess = (p: AccessPayload) => jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
export const verifyAccess = (t: string) => jwt.verify(t, env.JWT_ACCESS_SECRET) as AccessPayload;
