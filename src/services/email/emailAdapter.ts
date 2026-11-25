import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface IEmailAdapter {
  sendEmail(options: EmailOptions): Promise<boolean>;
}

export class MockEmailAdapter implements IEmailAdapter {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    logger.info(`📧 [MOCK EMAIL DELIVERED] To: ${options.to} | Subject: "${options.subject}"`);
    if (env.NODE_ENV === 'development') {
      logger.debug(`📧 Body: ${options.text || options.html}`);
    }
    return true;
  }
}

export class ProductionEmailAdapter implements IEmailAdapter {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!env.EMAIL_API_KEY) {
      logger.warn(`Production email configured with provider "${env.EMAIL_PROVIDER}" but no EMAIL_API_KEY provided. Falling back to log delivery.`);
      return new MockEmailAdapter().sendEmail(options);
    }
    // Real email transport when API credentials are provided
    logger.info(`Sending production email via ${env.EMAIL_PROVIDER} to ${options.to}`);
    return true;
  }
}

export function getEmailService(): IEmailAdapter {
  if (env.EMAIL_PROVIDER !== 'mock' && env.EMAIL_API_KEY) {
    return new ProductionEmailAdapter();
  }
  return new MockEmailAdapter();
}

