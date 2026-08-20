import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/asyncHandler';
import { validate } from '../../shared/middlewares/validate';
import { create, list } from './drop.controller';
import { createDropSchema } from './drop.types';

const router = Router();

/**
 * GET /api/drops
 * Returns all active drops with nested top-3 recent purchasers.
 */
router.get('/', asyncHandler(list));

/**
 * POST /api/drops
 * Initializes a new merch drop. No admin UI needed per spec.
 */
router.post('/', validate(createDropSchema), asyncHandler(create));

export default router;