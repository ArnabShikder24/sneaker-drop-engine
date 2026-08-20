import { Request, Response } from 'express';
import { createDrop, listDrops } from './drop.service';
import { CreateDropInput } from './drop.types';

/**
 * POST /api/drops
 * Creates a new merch drop.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateDropInput;
  const drop = await createDrop(input);
  res.status(201).json({ message: 'Drop created successfully.', drop });
}

/**
 * GET /api/drops
 * Lists all drops with the top-3 recent purchasers per drop (activity feed).
 */
export async function list(req: Request, res: Response): Promise<void> {
  const drops = await listDrops();
  res.status(200).json({ drops });
}