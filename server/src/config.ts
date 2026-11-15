export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  const jwtSecret = env.JWT_SECRET;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be set and at least 32 characters');
  return {
    port: Number(env.PORT ?? 8787),
    databaseUrl,
    jwtSecret,
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
