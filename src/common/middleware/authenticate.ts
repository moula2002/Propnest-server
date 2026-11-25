import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { TokenService } from '../../services/security/tokenService.js';
import { prisma } from '../../config/database.js';
import { AccountStatus } from '@prisma/client';

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token is missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Access token is missing');
    }

    const payload = TokenService.verifyAccessToken(token);

    // Verify user still exists in database and is ACTIVE
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, fullName: true, accountStatus: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw ApiError.unauthorized('User account no longer exists');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw ApiError.forbidden(`Account is ${user.accountStatus.toLowerCase()}. Access denied.`);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      accountStatus: user.accountStatus,
    };

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid access token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Access token has expired'));
    }
    next(error);
  }
};

