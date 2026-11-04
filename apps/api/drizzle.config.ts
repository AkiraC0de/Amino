import { defineConfig } from 'drizzle-kit';
import { loadConfig } from './src/config.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: loadConfig({ DATABASE_URL: databaseUrl }).databaseUrl },
});
