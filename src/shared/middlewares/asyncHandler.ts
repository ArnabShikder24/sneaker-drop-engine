import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so any rejected promise is forwarded to
 * Express's next(err) — preventing unhandled promise rejections from
 * crashing the process and keeping route code clean (no try/catch boilerplate).
 *
 * Usage:
 *   router.post('/drops', asyncHandler(dropController.create));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };