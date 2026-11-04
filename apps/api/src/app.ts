import cors from 'cors';
import express, { type Express, type Router } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';
import { currentUser } from './http/currentUser.js';
import { errorHandler, notFoundHandler } from './http/errorHandler.js';

export interface AppDeps {
  workouts?: unknown;
  exercises?: unknown;
  soreness?: unknown;
}

export function createApp(deps: AppDeps, extraRoutes?: (router: Router) => void): Express {
  void deps;
  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(currentUser);

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (extraRoutes) {
    const router = express.Router();
    extraRoutes(router);
    app.use(router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
