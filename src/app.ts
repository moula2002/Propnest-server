import express, { Application } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { corsMiddleware } from './config/cors.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import { apiLimiter } from './common/middleware/rateLimiter.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { apiV1Routes } from './routes/index.js';
import { swaggerDocument } from './docs/swagger.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './config/logger.js';
import { ApiError } from './common/utils/ApiError.js';

export const createApp = (): Application => {
  const app = express();

  // Trust reverse proxies (Render, Vercel, Nginx, AWS ELB)
  app.set('trust proxy', 1);

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

  // 5. Database-backed & Cached Uploads Serving
  const uploadDir = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIRECTORY);
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (dirErr) {
      logger.warn('Could not create upload directory:', dirErr);
    }
  }

  // First check local disk cache, then fallback to PostgreSQL database
  app.get('/uploads/:filename', async (req, res, next) => {
    try {
      const filename = path.basename(req.params.filename);
      const localFilePath = path.join(uploadDir, filename);

      if (fs.existsSync(localFilePath)) {
        return res.sendFile(localFilePath);
      }

      // Query persistent PostgreSQL database storage
      const dbFile = await prisma.uploadedFile.findUnique({
        where: { filename },
      });

      if (dbFile) {
        // Cache to local disk for fast subsequent requests
        try {
          fs.writeFileSync(localFilePath, dbFile.data);
        } catch (writeErr) {
          logger.warn('Could not cache file to local disk:', writeErr);
        }

        res.setHeader('Content-Type', dbFile.mimeType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(dbFile.data);
      }

      return res.status(404).json({ success: false, message: 'Image not found' });
    } catch (err) {
      logger.error(`Error serving file ${req.params.filename} from DB:`, err);
      next(err);
    }
  });

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

