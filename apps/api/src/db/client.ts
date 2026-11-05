import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sanitizeDatabaseUrl } from '../config.js';
import { logger } from '../logger.js';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export type PoolOptions = {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
};
export type DatabaseClient = { db: Db; pool: Pool; close(): Promise<void> };

export function createDb(databaseUrl: string, options: PoolOptions = {}): DatabaseClient {
  const pool = new Pool({
    connectionString: sanitizeDatabaseUrl(databaseUrl),
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10_000,
  });
  pool.on('error', (error: Error & { code?: string }) => {
    logger.error({ code: error.code }, 'Unexpected idle database client error');
  });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
