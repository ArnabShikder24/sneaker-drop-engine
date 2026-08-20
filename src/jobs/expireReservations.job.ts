import cron from 'node-cron';
import { Op } from 'sequelize';
import { sequelize, Reservation, Drop } from '../db/models/index';
import { emitStockUpdate } from '../sockets/index';

/**
 * Expiration sweep job.
 *
 * ARCHITECTURE CHOICE (for README):
 * We use a periodic DB sweep instead of per-reservation setTimeout timers.
 * Rationale: setTimeout timers live only in Node's event loop memory.
 * If the server crashes or restarts mid-wait, all pending timers are lost
 * and stock for those reservations never comes back — silent data corruption.
 *
 * A sweep re-derives the correct state from the database every few seconds,
 * regardless of server restarts. It's stateless, idempotent, and robust.
 * The trade-off is a 0–5 second imprecision window, which is acceptable
 * for a 60-second reservation window (< 10% error margin).
 *
 * For tighter precision: layer an in-memory setTimeout for the "happy path"
 * instant UI feel, but keep the sweep as the authoritative fallback.
 */
export function startExpireReservationsJob(): void {
  // Runs every 5 seconds
  cron.schedule('*/5 * * * * *', async () => {
    try {
      await expireStaleReservations();
    } catch (err) {
      // Swallow errors from the sweep — don't crash the process on transient DB issues
      console.error('[ExpireJob] Error during expiration sweep:', err);
    }
  });

  console.log('✅ Reservation expiration job started (every 5s).');
}

/**
 * Core sweep logic. Finds all active reservations past their expires_at
 * and releases their stock back to the drop — all atomically per reservation.
 */
async function expireStaleReservations(): Promise<void> {
  const now = new Date();

  // Find all candidates in one query before opening per-row transactions
  const staleReservations = await Reservation.findAll({
    where: {
      status: 'active',
      expires_at: { [Op.lt]: now },
    },
    // Limit per sweep to prevent a single cron run from holding locks for too long
    limit: 50,
  });

  if (staleReservations.length === 0) return;

  console.log(`[ExpireJob] Found ${staleReservations.length} stale reservation(s). Releasing...`);

  // Process each expired reservation in its own atomic transaction.
  // We do them serially (not Promise.all) to avoid lock contention on the drops table.
  for (const reservation of staleReservations) {
    await sequelize.transaction(async (t) => {
      // Re-check status inside the transaction to avoid double-processing
      // if two sweep runs overlap (idempotency guard)
      const locked = await Reservation.findByPk(reservation.id, {
        transaction: t,
        lock: t.LOCK.UPDATE, // SELECT FOR UPDATE — prevents concurrent sweep runs from double-expiring
      });

      if (!locked || locked.status !== 'active') return; // Already handled

      // Increment stock back — atomically
      await Drop.increment('available_stock', {
        by: 1,
        where: { id: reservation.drop_id },
        transaction: t,
      });

      // Fetch updated stock to broadcast
      const updatedDrop = await Drop.findByPk(reservation.drop_id, {
        attributes: ['available_stock'],
        transaction: t,
      });

      // Mark reservation as expired
      locked.status = 'expired';
      await locked.save({ transaction: t });

      const availableStock = updatedDrop?.available_stock ?? 0;

      // Emit after transaction commits (via .then chaining below)
      return { dropId: reservation.drop_id, availableStock };
    }).then((result) => {
      if (result) {
        emitStockUpdate(result.dropId, result.availableStock, 'expire');
        console.log(
          `[ExpireJob] Reservation ${reservation.id} expired. Drop ${result.dropId} stock restored to ${result.availableStock}.`,
        );
      }
    });
  }
}