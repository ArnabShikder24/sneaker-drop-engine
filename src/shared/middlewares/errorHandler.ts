import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../types/AppError';
import { env } from '../../config/env';

interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Central Express error-handling middleware.
 * Must be registered LAST, after all routes and other middleware.
 *
 * Handles three error types:
 * 1. AppError  — our domain errors with known statusCode + code
 * 2. ZodError  — validation failures → 400
 * 3. Everything else → 500 (internal server error)
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // AppError — intentional, domain-level errors
  if (err instanceof AppError) {
    const body: ErrorResponse = { error: err.message, code: err.code };
    res.status(err.statusCode).json(body);
    return;
  }

  // ZodError — input validation failures
  if (err instanceof ZodError) {
    const body: ErrorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    };
    res.status(400).json(body);
    return;
  }

  // Unknown errors — log fully in dev, hide details in prod
  console.error('[ErrorHandler] Unhandled error:', err);

  const body: ErrorResponse = {
    error:
      env.NODE_ENV === 'development' && err instanceof Error
        ? err.message
        : 'An unexpected error occurred.',
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(body);
}