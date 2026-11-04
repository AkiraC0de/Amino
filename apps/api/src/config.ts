export interface Config {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const rawDatabaseUrl = env.DATABASE_URL;
  if (!rawDatabaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const databaseUrl = new URL(rawDatabaseUrl);
  databaseUrl.searchParams.delete('channel_binding');

  return {
    port: Number(env.PORT ?? 3001),
    databaseUrl: databaseUrl.toString().replace(/\/$/, ''),
    nodeEnv: env.NODE_ENV ?? 'development',
  };
}
