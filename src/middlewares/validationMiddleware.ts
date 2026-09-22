import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', issues));
    }
    const data = parsed.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body) req.body = data.body;
    if (data.query) req.query = data.query as Request['query'];
    if (data.params) req.params = data.params as Request['params'];
    next();
  };
}

export function formatZodError(error: ZodError) {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}
