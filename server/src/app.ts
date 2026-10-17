// Money is stored as BigInt paise; JSON.stringify cannot serialise BigInt without this.
(BigInt.prototype as any).toJSON = function () { return Number(this); };

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { logger } from './utils/logger';
import { openApiDoc } from './docs/openapi';

export function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc()));
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',') }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestId);
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger }));
  app.use('/api/v1', apiRouter);
  app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
