import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validation middleware factory.
 * Pass a Zod schema; the middleware validates req.body and either:
 *   - replaces req.body with the parsed (and coerced) value on success, or
 *   - throws a ZodError which the central error handler converts to a 400.
 *
 * Usage:
 *   router.post('/drops', validate(createDropSchema), asyncHandler(controller.create));
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body); // throws ZodError on failure
    next();
  };
}