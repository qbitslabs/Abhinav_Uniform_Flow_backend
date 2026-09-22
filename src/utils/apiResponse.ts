import { Response } from 'express';

export function success<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: { total?: number; page?: number; limit?: number }
) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
  });
}

export function created<T>(res: Response, data: T, message?: string) {
  return success(res, data, message, 201);
}
