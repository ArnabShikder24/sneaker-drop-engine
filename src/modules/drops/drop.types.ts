import { z } from 'zod';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createDropSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  total_stock: z.number().int().positive(),
  starts_at: z.string().datetime({ message: 'starts_at must be a valid ISO 8601 datetime.' }),
});

export type CreateDropInput = z.infer<typeof createDropSchema>;

// ─── Response DTOs ────────────────────────────────────────────────────────────

/** A single recent purchaser, embedded in the drop card's activity feed */
export interface RecentPurchaser {
  username: string;
  purchased_at: Date;
}

/** The enriched drop response shape returned by GET /drops */
export interface DropWithActivityFeed {
  id: number;
  name: string;
  price: number;
  total_stock: number;
  available_stock: number;
  starts_at: Date;
  created_at: Date;
  recent_purchasers: RecentPurchaser[];
}