import { Request, Response } from 'express';
import { reserveDrop, completePurchase } from './reservation.service';

/**
 * POST /reservations
 * Body: { drop_id: number, user_id: number }
 */
export async function createReservation(req: Request, res: Response): Promise<void> {
  const { drop_id, user_id } = req.body as { drop_id: number; user_id: number };
  const { reservation, availableStock } = await reserveDrop(drop_id, user_id);
  res.status(201).json({
    message: 'Reservation created. You have 60 seconds to complete your purchase.',
    reservation,
    availableStock,
  });
}

/**
 * POST /reservations/:id/purchase
 * Body: { user_id: number }
 */
export async function purchase(req: Request, res: Response): Promise<void> {
  const reservationId = parseInt(String(req.params.id), 10);
  const { user_id } = req.body as { user_id: number };
  const purchaseRecord = await completePurchase(reservationId, user_id);
  res.status(201).json({
    message: 'Purchase completed successfully!',
    purchase: purchaseRecord,
  });
}
