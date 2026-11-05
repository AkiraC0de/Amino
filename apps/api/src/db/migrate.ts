import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config.js';
import { createDb } from './client.js';

const { db, close } = createDb(loadConfig(process.env).databaseUrl);
try {
  await migrate(db, { migrationsFolder: './src/db/migrations' });
} finally {
  await close();
}
