import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { env } from '../../config/env.js';

const COOKIE_NAME = 'refreshToken';

const getCookieOptions = (expiresAt: Date) => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict' as const,
  domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
  expires: expiresAt,
});

export class AuthController {
  static async register(req: Request, res: Response) {
    const user = await AuthService.register(req.body);
    return ApiResponse.created(res, user, 'User registered successfully');
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const { user, accessToken, refreshToken, expiresAt } = await AuthService.login(email, password, meta);

    res.cookie(COOKIE_NAME, refreshToken, getCookieOptions(expiresAt));

    return ApiResponse.success(
      res,
      { user, accessToken },
      'Logged in successfully'
    );
  }

  static async refresh(req: Request, res: Response) {
    const incomingToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const { accessToken, refreshToken, expiresAt } = await AuthService.refreshTokens(incomingToken, meta);

    res.cookie(COOKIE_NAME, refreshToken, getCookieOptions(expiresAt));

    return ApiResponse.success(
      res,
      { accessToken },
      'Token refreshed successfully'
    );
  }

  static async logout(req: Request, res: Response) {
    const incomingToken = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (incomingToken) {
      await AuthService.logout(incomingToken);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'strict',
    });

    return ApiResponse.success(res, null, 'Logged out successfully');
  }

  static async logoutAll(req: Request, res: Response) {
    if (req.user) {
      await AuthService.logoutAll(req.user.id);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'strict',
    });

    return ApiResponse.success(res, null, 'Logged out from all devices successfully');
  }

  static async getMe(req: Request, res: Response) {
    return ApiResponse.success(res, req.user, 'Current user profile retrieved');
  }

  static async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
    return ApiResponse.success(res, null, 'Password changed successfully. Please log in again.');
  }

  static async forgotPassword(req: Request, res: Response) {
    await AuthService.requestPasswordReset(req.body.email);
    return ApiResponse.success(
      res,
      null,
      'If your email address is registered in our platform, a password reset instruction has been sent.'
    );
  }

  static async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;
    await AuthService.resetPassword(token, newPassword);
    return ApiResponse.success(res, null, 'Password has been reset successfully. You may now log in.');
  }
}

