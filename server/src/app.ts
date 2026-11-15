import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type pg from 'pg';
import type { Config } from './config.js';

export function createApp(pool: pg.Pool, config: Config) {
  const app = new Hono();

  app.use('*', cors({ origin: config.corsOrigins, allowHeaders: ['Content-Type', 'Authorization'], maxAge: 600 }));

  app.get('/health', async (c) => {
    try {
      await pool.query('SELECT 1');
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
