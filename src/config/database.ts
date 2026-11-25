import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

const prismaClientSingleton = () => {
  const isTest = env.NODE_ENV === 'test';
  const client = new PrismaClient({
    datasources: {
      db: {
        url: isTest && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return client;
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('🐘 PostgreSQL Database connected successfully via Prisma Client');
  } catch (error) {
    logger.error('❌ Failed to connect to PostgreSQL database:', error);
    process.exit(1);
  }
}
