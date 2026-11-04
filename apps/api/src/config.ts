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

  const rawPort = env.PORT ?? '3001';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT');
  }

  const databaseUrl = new URL(rawDatabaseUrl);
  databaseUrl.searchParams.delete('channel_binding');

  return {
    port,
    databaseUrl: databaseUrl.toString().replace(/\/$/, ''),
    nodeEnv: env.NODE_ENV ?? 'development',
  };
}
