import { QueryTypes } from 'sequelize';
import { Drop, sequelize } from '../../db/models/index';
import { AppError } from '../../shared/types/AppError';
import { CreateDropInput, DropWithActivityFeed, RecentPurchaser } from './drop.types';

// ─── Create Drop ─────────────────────────────────────────────────────────────

/**
 * Creates a new merch drop.
 *
 * Key design decision: available_stock is initialized to total_stock at creation.
 * This single column is the source of truth — atomically decremented on reserve
 * and incremented on expiry. Never computed on-the-fly from counting reservations.
 */
export async function createDrop(input: CreateDropInput): Promise<Drop> {
  const drop = await Drop.create({
    name: input.name,
    price: input.price,
    total_stock: input.total_stock,
    available_stock: input.total_stock, // ← the initialization answer
    starts_at: new Date(input.starts_at),
  });
  return drop;
}

// ─── List Drops with Activity Feed ───────────────────────────────────────────

/**
 * Returns all drops with each drop's top-3 most recent purchasers.
 *
 * QUERY STRATEGY — single efficient query, no N+1:
 * We use a raw SQL query with a LATERAL subquery (Postgres-specific but optimal)
 * to fetch the 3 most recent purchases per drop in one round trip.
 *
 * Alternative approaches considered:
 * 1. N+1: one query per drop for its purchases — O(n) queries, unacceptable at scale.
 * 2. Fetch all purchases then group in JS — wastes bandwidth, unordered.
 * 3. ROW_NUMBER() window function with CTE — also valid, slightly more complex.
 *
 * LATERAL is the clearest and most efficient for "top N per group" in Postgres.
 */
export async function listDrops(): Promise<DropWithActivityFeed[]> {
  const rows = await sequelize.query<{
    id: number;
    name: string;
    price: string;
    total_stock: number;
    available_stock: number;
    starts_at: Date;
    created_at: Date;
    recent_purchasers: string; // JSON string from Postgres
  }>(
    `SELECT
       d.id,
       d.name,
       d.price,
       d.total_stock,
       d.available_stock,
       d.starts_at,
       d.created_at,
       (
         SELECT COALESCE(json_agg(sub), '[]'::json)
         FROM (
           SELECT u.username, p.created_at AS purchased_at
           FROM purchases p
           JOIN users u ON u.id = p.user_id
           WHERE p.drop_id = d.id
           ORDER BY p.created_at DESC
           LIMIT 3
         ) sub
       ) AS recent_purchasers
     FROM drops d
     ORDER BY d.created_at DESC`,
    { type: QueryTypes.SELECT },
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price), // Postgres DECIMAL comes as string
    total_stock: row.total_stock,
    available_stock: row.available_stock,
    starts_at: row.starts_at,
    created_at: row.created_at,
    recent_purchasers: (
      typeof row.recent_purchasers === 'string'
        ? JSON.parse(row.recent_purchasers)
        : row.recent_purchasers
    ) as RecentPurchaser[],
  }));
}

/**
 * Gets a single drop by ID. Throws 404 if not found.
 */
export async function getDropById(dropId: number): Promise<Drop> {
  const drop = await Drop.findByPk(dropId);
  if (!drop) {
    throw AppError.notFound(`Drop ${dropId} not found.`, 'DROP_NOT_FOUND');
  }
  return drop;
}