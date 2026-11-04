import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errors.js';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodType<T>, source: Source): RequestHandler {
  return (req, res, next) => {
    // Parsed values are available on res.locals.validated[source]; body and params remain replaced below.
    const input = source === 'query' ? req.query : req[source];
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten());
    }
    if (source === 'query') {
      res.locals.validated ??= {};
      res.locals.validated.query = result.data;
    } else {
      req[source] = result.data;
    }
    next();
  };
}
