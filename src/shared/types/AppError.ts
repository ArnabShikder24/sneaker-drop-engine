/**
 * Custom application error class.
 * Throw this anywhere in services/controllers — the central error handler
 * will catch it and return the correct HTTP status + JSON body.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  /** Machine-readable error code for client-side handling (e.g. 'SOLD_OUT', 'NOT_FOUND') */
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    // Restore prototype chain (required when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST'): AppError {
    return new AppError(message, 400, code);
  }

  static notFound(message: string, code = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, code);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(message, 409, code);
  }

  static forbidden(message: string, code = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, code);
  }
}
