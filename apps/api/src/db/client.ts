import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sanitizeDatabaseUrl } from '../config.js';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(databaseUrl: string): { db: Db; close(): Promise<void> } {
  const pool = new Pool({ connectionString: sanitizeDatabaseUrl(databaseUrl) });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
