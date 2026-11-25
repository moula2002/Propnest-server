import express, { Application } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { corsMiddleware } from './config/cors.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import { apiLimiter } from './common/middleware/rateLimiter.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { apiV1Routes } from './routes/index.js';
import { swaggerDocument } from './docs/swagger.js';
import { env } from './config/env.js';
import { ApiError } from './common/utils/ApiError.js';

export const createApp = (): Application => {
  const app = express();

  // 1. Security HTTP Headers with Cross-Origin Resource Policy for uploads
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. Strict CORS
  app.use(corsMiddleware);

  // 3. Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. Request Logging & Correlation ID
  app.use(requestLogger);

  // 5. Static uploads directory for development
  const uploadDir = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIRECTORY);
  app.use('/uploads', express.static(uploadDir));

  // 6. Swagger API Documentation UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // 7. General API Rate Limiting & REST API Routes
  app.use('/api/v1', apiLimiter, apiV1Routes);

  // 8. 404 Handler
  app.use((req, _res, next) => {
    next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

