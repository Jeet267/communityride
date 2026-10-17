import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  CLIENT_ORIGIN: z.string().url(),
  ROUTING_PROVIDER: z.enum(['osrm', 'mock']).default('osrm'),
  MAX_JOURNEY_METERS: z.coerce.number().default(500_000),
  DEMO_OTP: z.string().length(6).optional(),
  TRIP_START_WINDOW_MINUTES: z.coerce.number().default(60),
  UPLOAD_DIR: z.string().default('uploads-private'),
});

export const env = schema.parse(process.env);
