import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/asyncHandler';
import { validate } from '../../shared/middlewares/validate';
import { createReservation, purchase } from './reservation.controller';
import { reserveDropSchema, purchaseSchema } from './reservation.service';

const router = Router();

/**
 * POST /api/reservations
 * Atomically reserves a unit of a drop for a user.
 */
router.post('/', validate(reserveDropSchema), asyncHandler(createReservation));

/**
 * POST /api/reservations/:id/purchase
 * Completes a purchase for an active reservation.
 */
router.post('/:id/purchase', validate(purchaseSchema), asyncHandler(purchase));

export default router;