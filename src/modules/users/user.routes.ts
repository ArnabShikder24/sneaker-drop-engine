import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/asyncHandler';
import { validate } from '../../shared/middlewares/validate';
import { findOrCreateUser } from './user.service';
import { z } from 'zod';
import { Request, Response } from 'express';

const router = Router();

const createUserSchema = z.object({
  username: z.string().min(1).max(50),
});

/**
 * POST /api/users
 * Creates or retrieves a user by username. Used by the frontend to
 * get a user_id before making reservations (no auth needed per assessment).
 */
router.post(
  '/',
  validate(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.body as { username: string };
    const { user, created } = await findOrCreateUser(username);
    res.status(created ? 201 : 200).json({ user });
  }),
);

export default router;
