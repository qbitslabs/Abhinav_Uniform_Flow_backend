import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.error,
      message: err.message,
      statusCode: err.statusCode,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Request validation failed',
      statusCode: 400,
      details: err.issues,
    });
  }

  const mongoErr = err as { name?: string; code?: number; message?: string };
  if (mongoErr.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: mongoErr.message || 'Invalid data',
      statusCode: 400,
    });
  }
  if (mongoErr.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'A record with this unique value already exists',
      statusCode: 409,
    });
  }
  if (mongoErr.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Invalid identifier format',
      statusCode: 400,
    });
  }

  logger.error(mongoErr.message || 'Unhandled error', err);

  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: env.nodeEnv === 'production' ? 'An unexpected error occurred' : mongoErr.message || 'Unexpected error',
    statusCode: 500,
  });
}
