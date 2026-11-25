import { Request, Response } from 'express';
import { InquiryService } from './inquiry.service.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

export class InquiryController {
  static async createInquiry(req: Request, res: Response) {
    const propertyId = String(req.params.propertyId || req.params.id);
    const buyerId = req.user ? req.user.id : undefined;

    const inquiry = await InquiryService.createInquiry(propertyId, buyerId, req.body);
    return ApiResponse.created(res, inquiry, 'Inquiry submitted successfully. The property owner has been notified.');
  }

  static async createContactInquiry(req: Request, res: Response) {
    const buyerId = req.user ? req.user.id : undefined;
    const inquiry = await InquiryService.createContactInquiry(buyerId, req.body);
    return ApiResponse.created(res, inquiry, 'Thank you! Your message has been sent to the PropNest team.');
  }

  static async getMyInquiries(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const { inquiries, total } = await InquiryService.getInquiriesSentByBuyer(req.user!.id, skip, limit);
    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, inquiries, 'Your submitted inquiries', 200, meta);
  }

  static async getReceivedInquiries(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const { inquiries, total } = await InquiryService.getInquiriesReceivedByOwner(req.user!.id, skip, limit);
    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, inquiries, 'Inquiries received on your properties', 200, meta);
  }

  static async getInquiry(req: Request, res: Response) {
    const inquiry = await InquiryService.getInquiryById(String(req.params.id), req.user!.id, req.user!.role);
    return ApiResponse.success(res, inquiry, 'Inquiry retrieved successfully');
  }

  static async updateStatus(req: Request, res: Response) {
    const updated = await InquiryService.updateInquiryStatus(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      req.body.status
    );
    return ApiResponse.success(res, updated, 'Inquiry status updated successfully');
  }
}
