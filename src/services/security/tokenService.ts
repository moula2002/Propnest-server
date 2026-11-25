import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Role, AccountStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { AuthenticatedUserPayload } from '../../common/types/index.js';

export interface TokenClaims {
  sub: string;
  email: string;
  role: Role;
  fullName: string;
  accountStatus: AccountStatus;
}

export class TokenService {
  static signAccessToken(claims: TokenClaims): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    };
    return jwt.sign(claims, env.JWT_ACCESS_SECRET, options);
  }

  static signRefreshToken(userId: string): { token: string; expiresAt: Date } {
    // Generate secure cryptographically random token string
    const randomSecret = crypto.randomBytes(40).toString('hex');
    const options: SignOptions = {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    };
    const token = jwt.sign({ sub: userId, nonce: randomSecret }, env.JWT_REFRESH_SECRET, options);

    // Calculate expiration date (7 days default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return { token, expiresAt };
  }

  static verifyAccessToken(token: string): AuthenticatedUserPayload {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    return {
      id: decoded.sub as string,
      email: decoded.email as string,
      role: decoded.role as Role,
      fullName: decoded.fullName as string,
      accountStatus: decoded.accountStatus as AccountStatus,
    };
  }

  static verifyRefreshToken(token: string): { userId: string } {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    return { userId: decoded.sub as string };
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static generateRandomResetToken(): { rawToken: string; hashedToken: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity
    return { rawToken, hashedToken, expiresAt };
  }
}

