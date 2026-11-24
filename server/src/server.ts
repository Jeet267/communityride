import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const server = buildApp().listen(env.PORT, () => {
  logger.info(`API on :${env.PORT} — docs at /api/docs`);
  logger.info(`OTP delivery → SMS: ${env.SMS_PROVIDER}, email: ${env.EMAIL_PROVIDER}`);
  if (env.NODE_ENV === 'production' && (env.SMS_PROVIDER === 'console' || env.EMAIL_PROVIDER === 'console'))
    logger.warn('OTP provider is "console": real users will not receive codes. Set SMS_PROVIDER / EMAIL_PROVIDER.');
});

// Friendly message instead of a stack trace when an old server is still running on the port.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${env.PORT} is already in use (an old server is still running).`);
    console.error(`   Fix: lsof -ti:${env.PORT} | xargs kill   — then run npm run dev again.\n`);
    process.exit(1);
  }
  throw err;
});
