import { Router } from 'express';
import { FavoriteController } from './favorite.controller.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(FavoriteController.listFavorites));
router.post('/:propertyId', asyncHandler(FavoriteController.addFavorite));
router.delete('/:propertyId', asyncHandler(FavoriteController.removeFavorite));

export const favoriteRoutes = router;

