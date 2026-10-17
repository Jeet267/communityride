import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

buildApp().listen(env.PORT, () => logger.info(`API on :${env.PORT} — docs at /api/docs`));
