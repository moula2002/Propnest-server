import { Request, Response } from 'express';
import { PropertyService } from './property.service.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { PropertySearchService } from '../search/search.service.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

export class PropertyController {
  static async listProperties(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const { properties, total } = await PropertySearchService.searchProperties(req.query, skip, limit);
    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, properties, 'Properties retrieved successfully', 200, meta);
  }

  static async getProperty(req: Request, res: Response) {
    const identifier = String(req.params.idOrSlug || req.params.id || req.params.slug);
    const requestingUser = req.user ? { id: req.user.id, role: req.user.role } : undefined;
    const property = await PropertyService.getPropertyByIdOrSlug(identifier, requestingUser);
    return ApiResponse.success(res, property, 'Property retrieved successfully');
  }

  static async getSimilarProperties(req: Request, res: Response) {
    const propertyId = String(req.params.id);
    const similar = await PropertySearchService.getSimilarProperties(propertyId);
    return ApiResponse.success(res, similar, 'Similar properties retrieved successfully');
  }

  static async createProperty(req: Request, res: Response) {
    const property = await PropertyService.createProperty(req.user!.id, req.body);
    return ApiResponse.created(res, property, 'Property listing created in DRAFT status');
  }

  static async updateProperty(req: Request, res: Response) {
    const updated = await PropertyService.updateProperty(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      req.body
    );
    return ApiResponse.success(res, updated, 'Property updated successfully');
  }

  static async updateStatus(req: Request, res: Response) {
    const updated = await PropertyService.updatePropertyStatus(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      req.body.status
    );
    return ApiResponse.success(res, updated, 'Property status updated successfully');
  }

  static async submitForApproval(req: Request, res: Response) {
    const updated = await PropertyService.updatePropertyStatus(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      'PENDING_APPROVAL' as any
    );
    return ApiResponse.success(res, updated, 'Property submitted for administrative approval');
  }

  static async deleteProperty(req: Request, res: Response) {
    await PropertyService.deleteProperty(String(req.params.id), req.user!.id, req.user!.role);
    return ApiResponse.success(res, null, 'Property deleted successfully');
  }

  // --- Image Handlers ---

  static async uploadImages(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    const uploaded = await PropertyService.uploadPropertyImages(String(req.params.id), files);
    return ApiResponse.created(res, uploaded, `${uploaded.length} image(s) uploaded successfully`);
  }

  static async deleteImage(req: Request, res: Response) {
    await PropertyService.deletePropertyImage(String(req.params.id), String(req.params.imageId));
    return ApiResponse.success(res, null, 'Property image deleted successfully');
  }

  static async setPrimaryImage(req: Request, res: Response) {
    await PropertyService.setPrimaryImage(String(req.params.id), String(req.params.imageId));
    return ApiResponse.success(res, null, 'Primary image updated successfully');
  }

  static async reorderImages(req: Request, res: Response) {
    await PropertyService.reorderImages(String(req.params.id), req.body.images);
    return ApiResponse.success(res, null, 'Images reordered successfully');
  }
}
