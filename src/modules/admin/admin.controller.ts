import { Request, Response } from 'express';
import { AdminService } from './admin.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { PropertyStatus, Role, AccountStatus, InquiryStatus, ListingType } from '@prisma/client';
import { env } from '../../config/env.js';
import { getStorageService } from '../../services/storage/storageAdapter.js';
import { ApiError } from '../../common/utils/ApiError.js';

const COOKIE_NAME = 'refreshToken';

const getCookieOptions = (expiresAt: Date) => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict' as const,
  domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
  expires: expiresAt,
});

export class AdminController {
  /**
   * Admin Authentication
   */
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const { user, accessToken, refreshToken, expiresAt } = await AdminService.adminLogin(email, password, meta);

    res.cookie(COOKIE_NAME, refreshToken, getCookieOptions(expiresAt));

    return ApiResponse.success(
      res,
      { user, accessToken },
      'Administrator logged in successfully'
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

  static async getMe(req: Request, res: Response) {
    const admin = await AdminService.getUserById(req.user!.id);
    return ApiResponse.success(res, admin, 'Current admin profile retrieved');
  }

  static async getProfile(req: Request, res: Response) {
    const admin = await AdminService.getUserById(req.user!.id);
    return ApiResponse.success(res, admin, 'Admin profile retrieved');
  }

  static async updateProfile(req: Request, res: Response) {
    const updated = await AdminService.updateAdminProfile(req.user!.id, req.body);
    return ApiResponse.success(res, updated, 'Admin profile updated successfully');
  }

  static async uploadAvatar(req: Request, res: Response) {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No avatar image provided');

    const storage = getStorageService();
    const result = await storage.uploadFile(file);
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const absoluteUrl = `${protocol}://${host}${result.imageUrl}`;

    const updated = await AdminService.updateAdminProfile(req.user!.id, {
      profileImage: absoluteUrl,
    });

    return ApiResponse.success(res, updated, 'Admin avatar updated successfully');
  }

  static async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;
    await AdminService.changeAdminPassword(req.user!.id, currentPassword, newPassword);

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'strict',
    });

    return ApiResponse.success(res, null, 'Admin password changed successfully. Please log in again.');
  }

  /**
   * Dashboard
   */
  static async getDashboard(_req: Request, res: Response) {
    const metrics = await AdminService.getDashboardMetrics();
    return ApiResponse.success(res, metrics, 'Admin dashboard metrics retrieved');
  }

  static async getDashboardStats(_req: Request, res: Response) {
    const metrics = await AdminService.getDashboardMetrics();
    return ApiResponse.success(res, metrics, 'Admin dashboard metrics retrieved');
  }

  static async getRecentActivity(_req: Request, res: Response) {
    const activity = await AdminService.getRecentActivity();
    return ApiResponse.success(res, activity, 'Recent activity retrieved');
  }

  /**
   * Users
   */
  static async listUsers(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search as string | undefined;
    const role = req.query.role as Role | undefined;
    const status = req.query.status as AccountStatus | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const { total, users } = await AdminService.listUsers({
      skip,
      take: limit,
      search,
      role,
      status,
      from,
      to,
      sortBy,
      sortOrder,
    });

    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, users, 'Users retrieved successfully', 200, meta);
  }

  static async getUserById(req: Request, res: Response) {
    const user = await AdminService.getUserById(String(req.params.id));
    return ApiResponse.success(res, user, 'User details retrieved');
  }

  static async updateUserStatus(req: Request, res: Response) {
    const updated = await AdminService.updateUserStatus(
      req.user!.id,
      String(req.params.id),
      req.body.status,
      req.body.reason
    );
    return ApiResponse.success(res, updated, 'User status updated successfully');
  }

  static async updateUserRole(req: Request, res: Response) {
    const updated = await AdminService.updateUserRole(
      req.user!.id,
      String(req.params.id),
      req.body.role
    );
    return ApiResponse.success(res, updated, 'User role updated successfully');
  }

  /**
   * Properties
   */
  static async listProperties(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search as string | undefined;
    const status = req.query.status as PropertyStatus | undefined;
    const city = req.query.city as string | undefined;
    const locality = req.query.locality as string | undefined;
    const propertyType = req.query.propertyType as string | undefined;
    const listingType = req.query.listingType as ListingType | undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const { total, properties } = await AdminService.listProperties({
      skip,
      take: limit,
      search,
      status,
      city,
      locality,
      propertyType,
      listingType,
      minPrice,
      maxPrice,
      from,
      to,
      sortBy,
      sortOrder,
    });

    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, properties, 'Properties retrieved successfully', 200, meta);
  }

  static async listPendingProperties(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search as string | undefined;

    const { total, properties } = await AdminService.listPendingProperties(skip, limit, search);
    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, properties, 'Pending properties retrieved for moderation', 200, meta);
  }

  static async getPropertyById(req: Request, res: Response) {
    const property = await AdminService.getPropertyById(String(req.params.id));
    return ApiResponse.success(res, property, 'Property details retrieved');
  }

  static async approveProperty(req: Request, res: Response) {
    const approved = await AdminService.approveProperty(req.user!.id, String(req.params.id));
    return ApiResponse.success(res, approved, 'Property listing approved and published');
  }

  static async rejectProperty(req: Request, res: Response) {
    const rejected = await AdminService.rejectProperty(req.user!.id, String(req.params.id), req.body.reason);
    return ApiResponse.success(res, rejected, 'Property listing rejected with feedback');
  }

  static async updatePropertyStatus(req: Request, res: Response) {
    const updated = await AdminService.updatePropertyStatus(
      req.user!.id,
      String(req.params.id),
      req.body.status,
      req.body.reason
    );
    return ApiResponse.success(res, updated, 'Property status updated successfully');
  }

  static async createProperty(req: Request, res: Response) {
    const created = await AdminService.createProperty(req.user!.id, req.body);
    return ApiResponse.created(res, created, 'Property created and published successfully');
  }

  static async getCategoryStats(_req: Request, res: Response) {
    const stats = await AdminService.getCategoryStats();
    return ApiResponse.success(res, stats, 'Category and amenity statistics retrieved');
  }

  static async createCategory(req: Request, res: Response) {
    const created = await AdminService.createCategory(req.body);
    return ApiResponse.created(res, created, 'Category created successfully');
  }

  static async updateCategory(req: Request, res: Response) {
    const updated = await AdminService.updateCategory(String(req.params.id), req.body);
    return ApiResponse.success(res, updated, 'Category updated successfully');
  }

  static async deleteCategory(req: Request, res: Response) {
    await AdminService.deleteCategory(String(req.params.id));
    return ApiResponse.success(res, null, 'Category deleted successfully');
  }

  static async updateProperty(req: Request, res: Response) {
    const updated = await AdminService.updateProperty(
      req.user!.id,
      String(req.params.id),
      req.body
    );
    return ApiResponse.success(res, updated, 'Property updated successfully');
  }

  static async deleteProperty(req: Request, res: Response) {
    await AdminService.deleteProperty(req.user!.id, String(req.params.id));
    return ApiResponse.success(res, null, 'Property deleted by administrator');
  }

  static async getModerationHistory(req: Request, res: Response) {
    const history = await AdminService.getModerationHistory(String(req.params.id));
    return ApiResponse.success(res, history, 'Property moderation history retrieved');
  }

  /**
   * Inquiries
   */
  static async listInquiries(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search as string | undefined;
    const status = req.query.status as InquiryStatus | undefined;
    const city = req.query.city as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const { total, inquiries } = await AdminService.listInquiries({
      skip,
      take: limit,
      search,
      status,
      city,
      from,
      to,
      sortBy,
      sortOrder,
    });

    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, inquiries, 'Inquiries retrieved successfully', 200, meta);
  }

  static async getInquiryById(req: Request, res: Response) {
    const inquiry = await AdminService.getInquiryById(String(req.params.id));
    return ApiResponse.success(res, inquiry, 'Inquiry details retrieved');
  }

  static async updateInquiryStatus(req: Request, res: Response) {
    const updated = await AdminService.updateInquiryStatus(
      req.user!.id,
      String(req.params.id),
      req.body.status
    );
    return ApiResponse.success(res, updated, 'Inquiry status updated successfully');
  }

  /**
   * Reports & Analytics
   */
  static async getUserReports(_req: Request, res: Response) {
    const reports = await AdminService.getUserReports();
    return ApiResponse.success(res, reports, 'User growth report retrieved');
  }

  static async getPropertyReports(_req: Request, res: Response) {
    const reports = await AdminService.getPropertyReports();
    return ApiResponse.success(res, reports, 'Property report retrieved');
  }

  static async getInquiryReports(_req: Request, res: Response) {
    const reports = await AdminService.getInquiryReports();
    return ApiResponse.success(res, reports, 'Inquiry report retrieved');
  }

  static async getAnalytics(_req: Request, res: Response) {
    const analytics = await AdminService.getAnalytics();
    return ApiResponse.success(res, analytics, 'Platform analytics retrieved');
  }

  /**
   * Audit Logs
   */
  static async getAuditLogs(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search as string | undefined;
    const action = req.query.action as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const actorId = req.query.actorId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const { total, logs } = await AdminService.getAuditLogs({
      skip,
      take: limit,
      search,
      action,
      entityType,
      actorId,
      from,
      to,
    });

    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, logs, 'Administrative audit logs retrieved', 200, meta);
  }

  static async getAuditLogById(req: Request, res: Response) {
    const log = await AdminService.getAuditLogById(String(req.params.id));
    return ApiResponse.success(res, log, 'Audit log details retrieved');
  }
}
