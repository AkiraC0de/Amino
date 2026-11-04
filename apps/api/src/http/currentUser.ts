import type { RequestHandler } from 'express';
import { DEFAULT_USER_ID } from '../constants.js';

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export const currentUser: RequestHandler = (req, _res, next) => {
  req.userId = DEFAULT_USER_ID;
  next();
};
