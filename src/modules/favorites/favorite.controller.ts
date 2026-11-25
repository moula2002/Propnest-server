import { Request, Response } from 'express';
import { FavoriteService } from './favorite.service.js';
import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

export class FavoriteController {
  static async addFavorite(req: Request, res: Response) {
    const favorite = await FavoriteService.addFavorite(req.user!.id, String(req.params.propertyId));
    return ApiResponse.created(res, favorite, 'Property added to favorites');
  }

  static async removeFavorite(req: Request, res: Response) {
    await FavoriteService.removeFavorite(req.user!.id, String(req.params.propertyId));
    return ApiResponse.success(res, null, 'Property removed from favorites');
  }

  static async listFavorites(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query);
    const { favorites, total } = await FavoriteService.getUserFavorites(req.user!.id, skip, limit);
    const meta = buildPaginationMeta(total, page, limit);
    return ApiResponse.success(res, favorites, 'Favorites retrieved successfully', 200, meta);
  }
}
