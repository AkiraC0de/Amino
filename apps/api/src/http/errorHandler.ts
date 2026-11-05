import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './errors.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Not found'));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const bodyParserError = error as { type?: string; status?: number };
  const parserError = bodyParserError.type === 'entity.parse.failed'
    ? new AppError(400, 'INVALID_JSON', 'Invalid JSON')
    : bodyParserError.type === 'entity.too.large'
      ? new AppError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large')
      : undefined;
  const appError = parserError ?? (error instanceof AppError ? error : new AppError(500, 'INTERNAL', 'Internal server error'));
  const envelope = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
    },
  };
  res.status(appError.status).json(envelope);
};
