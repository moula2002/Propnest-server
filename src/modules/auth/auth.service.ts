import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../common/utils/ApiError.js';
import { TokenService } from '../../services/security/tokenService.js';
import { getEmailService } from '../../services/email/emailAdapter.js';
import { AccountStatus, Role } from '@prisma/client';

export class AuthService {
  static async register(data: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    role?: Role;
  }) {
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists');
    }

    // Check duplicate phone if provided
    if (data.phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: data.phone, deletedAt: null },
      });
      if (existingPhone) {
        throw ApiError.conflict('An account with this phone number already exists');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName.trim(),
        email: normalizedEmail,
        phone: data.phone?.trim(),
        passwordHash,
        role: data.role || Role.USER,
        accountStatus: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        accountStatus: true,
        createdAt: true,
      },
    });

    return user;
  }

  static async login(
    email: string,
    pass: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deletedAt) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw ApiError.forbidden('Your account has been suspended. Please contact support.');
    }

    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      throw ApiError.forbidden('Your account has been deactivated.');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Issue tokens
    const accessToken = TokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      accountStatus: user.accountStatus,
    });

    const { token: refreshToken, expiresAt } = TokenService.signRefreshToken(user.id);
    const tokenHash = TokenService.hashToken(refreshToken);

    // Save refresh session in DB
    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: meta?.ip,
        deviceInfo: meta?.userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
        profileImage: user.profileImage,
      },
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  static async refreshTokens(
    incomingRefreshToken: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    let decodedPayload: { userId: string };
    try {
      decodedPayload = TokenService.verifyRefreshToken(incomingRefreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const tokenHash = TokenService.hashToken(incomingRefreshToken);

    const session = await prisma.refreshSession.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw ApiError.unauthorized('Invalid session. Please login again.');
    }

    // REUSE DETECTION: If this session was already revoked, token reuse / compromise is detected!
    if (session.revokedAt) {
      // Invalidate ALL sessions for this user immediately
      await prisma.refreshSession.updateMany({
        where: { userId: decodedPayload.userId },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized('Session compromise detected. All active logins have been revoked.');
    }

    if (new Date() > session.expiresAt) {
      throw ApiError.unauthorized('Refresh token has expired');
    }

    if (session.user.accountStatus !== AccountStatus.ACTIVE) {
      throw ApiError.forbidden('User account is not active');
    }

    // Revoke current session (Rotation)
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create new refresh session
    const { token: newRefreshToken, expiresAt } = TokenService.signRefreshToken(session.userId);
    const newTokenHash = TokenService.hashToken(newRefreshToken);

    await prisma.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash: newTokenHash,
        expiresAt,
        ipAddress: meta?.ip,
        deviceInfo: meta?.userAgent,
      },
    });

    // Generate new access token
    const accessToken = TokenService.signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role,
      fullName: session.user.fullName,
      accountStatus: session.user.accountStatus,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    };
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = TokenService.hashToken(refreshToken);
    await prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static async logoutAll(userId: string) {
    await prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');

    const isMatch = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Current password does not match');
    }

    const newHash = await bcrypt.hash(newPass, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalidate existing refresh sessions for security
    await prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static async requestPasswordReset(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.deletedAt || user.accountStatus !== AccountStatus.ACTIVE) {
      // Return gracefully without leaking email existence
      return;
    }

    const { rawToken, hashedToken, expiresAt } = TokenService.generateRandomResetToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashedToken,
        expiresAt,
      },
    });

    const emailService = getEmailService();
    await emailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Hello ${user.fullName}, use this token to reset your password: ${rawToken}. Valid for 1 hour.`,
    });
  }

  static async resetPassword(rawToken: string, newPass: string) {
    const hashedToken = TokenService.hashToken(rawToken);

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashedToken,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw ApiError.badRequest('Invalid or expired password reset token');
    }

    const newHash = await bcrypt.hash(newPass, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshSession.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}

