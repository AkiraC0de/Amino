import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errors.js';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodType<T>, source: Source): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten());
    }
    req[source] = result.data;
    next();
  };
}
