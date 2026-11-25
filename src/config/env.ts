import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long').default('super_secret_access_jwt_key_at_least_32_characters_long_for_security_1234'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long').default('super_secret_refresh_jwt_key_at_least_32_characters_long_for_security_5678'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  ADMIN_URL: z.string().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  STORAGE_PROVIDER: z.enum(['local', 'cloudinary', 's3']).default('local'),
  LOCAL_UPLOAD_DIRECTORY: z.string().default('./uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['mock', 'sendgrid', 'smtp']).default('mock'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@realestateplatform.com'),
  ADMIN_EMAIL: z.string().email().default('admin@realestateplatform.com'),
  ADMIN_PASSWORD: z.string().default('AdminSecurePass@2026'),
  ADMIN_NAME: z.string().default('Platform Administrator'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;

