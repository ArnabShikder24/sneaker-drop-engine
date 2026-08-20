import { QueryTypes } from 'sequelize';
import { sequelize, Reservation, Purchase, Drop } from '../../db/models/index';
import { AppError } from '../../shared/types/AppError';
import { emitStockUpdate } from '../../sockets/index';
import { z } from 'zod';

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const reserveDropSchema = z.object({
  drop_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
});

export const purchaseSchema = z.object({
  user_id: z.number().int().positive(),
});

export type ReserveDropInput = z.infer<typeof reserveDropSchema>;

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Atomically reserves a unit of a drop for a user.
 *
 * CONCURRENCY STRATEGY:
 * We use a single conditional UPDATE: `UPDATE drops SET available_stock = available_stock - 1
 * WHERE id = :dropId AND available_stock > 0`.
 *
 * PostgreSQL serializes concurrent writers to the same row at the UPDATE level.
 * This means 100 simultaneous requests racing for the last unit will all hit
 * the DB, but only ONE will find `available_stock > 0` and succeed — the rest
 * get 0 rows affected and receive a 409. No explicit `SELECT ... FOR UPDATE`
 * lock needed (though that's a valid alternative — see README).
 *
 * ISOLATION LEVEL: READ COMMITTED (Postgres default).
 * This is sufficient because the conditional WHERE clause on the UPDATE itself
 * acts as the guard. Using SERIALIZABLE would also work but is heavier.
 */
export async function reserveDrop(
  dropId: number,
  userId: number,
): Promise<{ reservation: Reservation; availableStock: number }> {
  return sequelize.transaction(async (t) => {
    // Check if drop exists first (outside the critical section — not a race concern)
    const drop = await Drop.findByPk(dropId, { transaction: t });
    if (!drop) {
      throw AppError.notFound(`Drop ${dropId} not found.`, 'DROP_NOT_FOUND');
    }

    // Check for an already-active reservation by this user for this drop
    const existingReservation = await Reservation.findOne({
      where: { drop_id: dropId, user_id: userId, status: 'active' },
      transaction: t,
    });
    if (existingReservation) {
      throw AppError.conflict(
        'You already have an active reservation for this drop.',
        'ALREADY_RESERVED',
      );
    }

    /**
     * THE CRITICAL ATOMIC UPDATE.
     * This is the heart of the concurrency solution.
     * Postgres guarantees that concurrent UPDATEs to the same row are serialized —
     * only ONE transaction can decrement when available_stock = 1.
     * All others will see 0 rows affected.
     */
    const [updatedRows] = await sequelize.query<{ available_stock: number }>(
      `UPDATE drops
         SET available_stock = available_stock - 1
       WHERE id = :dropId
         AND available_stock > 0
       RETURNING available_stock`,
      {
        replacements: { dropId },
        type: QueryTypes.UPDATE,
        transaction: t,
      },
    );

    // updatedRows is the count of affected rows from sequelize's raw UPDATE
    if ((updatedRows as unknown as number) === 0) {
      throw AppError.conflict(
        'Sorry, this drop is sold out.',
        'SOLD_OUT',
      );
    }

    // Fetch the current available_stock after decrement
    const updatedDrop = await Drop.findByPk(dropId, {
      attributes: ['available_stock'],
      transaction: t,
    });

    const availableStock = updatedDrop!.available_stock;

    // Insert the reservation record in the same transaction
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds from now
    const reservation = await Reservation.create(
      {
        drop_id: dropId,
        user_id: userId,
        status: 'active',
        expires_at: expiresAt,
      },
      { transaction: t },
    );

    // Transaction committed — now safe to notify clients
    // (We return availableStock so the route handler can emit after t commits)
    return { reservation, availableStock };
  }).then((result) => {
    // Emit AFTER transaction commits — never inside, to avoid notifying about rolled-back changes
    emitStockUpdate(dropId, result.availableStock);
    return result;
  });
}

/**
 * Completes a purchase for an active reservation.
 *
 * Rules:
 * - Reservation must belong to the requesting user
 * - Reservation must be 'active' (not expired or already completed)
 * - expires_at must be in the future (server-side clock check — don't trust the client)
 *
 * Note on stock: available_stock was already decremented at reservation time.
 * A purchase simply converts the temporary hold into a permanent sale — no
 * further stock changes needed, so no STOCK_UPDATED event is emitted here.
 */
export async function completePurchase(
  reservationId: number,
  userId: number,
): Promise<Purchase> {
  return sequelize.transaction(async (t) => {
    const reservation = await Reservation.findByPk(reservationId, { transaction: t });

    if (!reservation) {
      throw AppError.notFound('Reservation not found.', 'RESERVATION_NOT_FOUND');
    }
    if (reservation.user_id !== userId) {
      throw AppError.forbidden(
        'This reservation does not belong to you.',
        'RESERVATION_FORBIDDEN',
      );
    }
    if (reservation.status !== 'active') {
      throw AppError.conflict(
        `Reservation is ${reservation.status}. Only active reservations can be purchased.`,
        'RESERVATION_NOT_ACTIVE',
      );
    }
    // Server-side expiry check (the sweep may not have run yet in this exact window)
    if (new Date() > reservation.expires_at) {
      throw AppError.conflict(
        'Your reservation has expired. Please try reserving again.',
        'RESERVATION_EXPIRED',
      );
    }

    // Mark reservation as completed
    reservation.status = 'completed';
    await reservation.save({ transaction: t });

    // Record the purchase
    const purchase = await Purchase.create(
      {
        drop_id: reservation.drop_id,
        user_id: userId,
        reservation_id: reservationId,
      },
      { transaction: t },
    );

    return purchase;
  });
}