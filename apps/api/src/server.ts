import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { createDrizzleWorkoutRepository } from './repositories/workouts.drizzle.js';
import { createWorkoutService } from './services/workouts.js';

interface ClosableServer {
  close(callback: (error?: Error) => void): void;
  closeIdleConnections?: () => void;
}

export function createShutdown(server: ClosableServer, exit: (code: number) => void = process.exit): () => void {
  let shuttingDown = false;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (shuttingDown) return;
    shuttingDown = true;
    forceTimer = setTimeout(() => exit(1), 10_000);
    forceTimer.unref();
    server.close((error) => {
      if (forceTimer) clearTimeout(forceTimer);
      exit(error ? 1 : 0);
    });
    server.closeIdleConnections?.();
  };
}

export function isMainModule(metaUrl: string, argv1: string | undefined): boolean {
  if (argv1 === undefined) return false;
  const fileUrl = pathToFileURL(argv1).href;
  const posixFileUrl = argv1.startsWith('/') ? `file://${argv1}` : undefined;
  return metaUrl === fileUrl || metaUrl === posixFileUrl;
}

export function startServer(): Server {
  const config = loadConfig(process.env);
  const database = createDb(config.databaseUrl);
  const service = createWorkoutService(createDrizzleWorkoutRepository(database.db));
  const app = createApp({ workouts: service });
  const server = createServer(app);
  server.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });
  const shutdown = createShutdown({ close: (callback) => server.close((error) => { void database.close().then(() => callback(error)); }), closeIdleConnections: () => server.closeIdleConnections() });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (isMainModule(import.meta.url, process.argv[1])) {
  startServer();
}
