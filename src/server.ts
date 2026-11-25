import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, prisma } from './config/database.js';

const startServer = async () => {
  // Ensure database is reachable
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Real Estate Platform API Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📚 Swagger Documentation accessible at: http://localhost:${env.PORT}/api-docs`);
    logger.info(`🩺 Health check accessible at: http://localhost:${env.PORT}/api/v1/health`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully terminating server...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await prisma.$disconnect();
      logger.info('PostgreSQL connections disconnected. Goodbye!');
      process.exit(0);
    });

    // Force shutdown after 10s timeout
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

startServer();

