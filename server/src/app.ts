import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type pg from 'pg';
import { hashPassword, RateLimiter, requireAuth, signToken, verifyPassword, type AuthEnv } from './auth.js';
import type { Config } from './config.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body: unknown): { email: string; password: string } | null {
  if (!body || typeof body !== 'object') return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 254 || password.length > 200) return null;
  return { email: e, password };
}

export function createApp(pool: pg.Pool, config: Config) {
  const app = new Hono<AuthEnv>();
  const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);
  const auth = requireAuth(config.jwtSecret);

  app.use('*', cors({ origin: config.corsOrigins, allowHeaders: ['Content-Type', 'Authorization'], maxAge: 600 }));

  app.get('/health', async (c) => {
    try {
      await pool.query('SELECT 1');
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  app.post('/auth/register', async (c) => {
    const creds = readCredentials(await c.req.json().catch(() => null));
    if (!creds) return c.json({ error: 'invalid_input' }, 400);
    if (creds.password.length < 8) return c.json({ error: 'password_too_short' }, 400);
    const hash = await hashPassword(creds.password);
    try {
      const { rows } = await pool.query<{ id: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [creds.email, hash],
      );
      const id = rows[0].id;
      return c.json({ token: signToken(id, config.jwtSecret), user: { id, email: creds.email } }, 201);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') return c.json({ error: 'email_taken' }, 409);
      throw err;
    }
  });

  app.post('/auth/login', async (c) => {
    const creds = readCredentials(await c.req.json().catch(() => null));
    if (!creds) return c.json({ error: 'invalid_credentials' }, 401);
    if (!loginLimiter.hit(creds.email)) return c.json({ error: 'too_many_attempts' }, 429);
    const { rows } = await pool.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE lower(email) = $1',
      [creds.email],
    );
    // Same error whether the email exists or not
    const ok = rows[0] ? await verifyPassword(creds.password, rows[0].password_hash) : false;
    if (!ok) return c.json({ error: 'invalid_credentials' }, 401);
    return c.json({ token: signToken(rows[0].id, config.jwtSecret), user: { id: rows[0].id, email: creds.email } });
  });

  app.get('/me', auth, async (c) => {
    const { rows } = await pool.query<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = $1', [
      c.get('userId'),
    ]);
    if (!rows[0]) return c.json({ error: 'unauthorized' }, 401);
    return c.json({ user: rows[0] });
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
