import { serve } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });

const ran = await migrate(pool, fileURLToPath(new URL('../migrations', import.meta.url)));
if (ran.length) console.log(`Ran migrations: ${ran.join(', ')}`);

const server = serve({ fetch: createApp(pool, config).fetch, port: config.port }, (info) =>
  console.log(`Løft API listening on :${info.port}`),
);

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
