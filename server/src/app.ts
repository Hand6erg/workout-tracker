import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
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

  type StateRow = { state: unknown; version: number; updated_at: Date };
  const stateJson = (r: StateRow) => ({ state: r.state, version: r.version, updatedAt: r.updated_at.toISOString() });

  app.get('/state', auth, async (c) => {
    const { rows } = await pool.query<StateRow>('SELECT state, version, updated_at FROM user_state WHERE user_id = $1', [
      c.get('userId'),
    ]);
    if (!rows[0]) return c.json({ error: 'not_found' }, 404);
    return c.json(stateJson(rows[0]));
  });

  app.put(
    '/state',
    auth,
    bodyLimit({ maxSize: 5 * 1024 * 1024, onError: (c) => c.json({ error: 'too_large' }, 413) }),
    async (c) => {
      const body = (await c.req.json().catch(() => null)) as { state?: unknown; baseVersion?: unknown } | null;
      const state = body?.state;
      if (!state || typeof state !== 'object' || Array.isArray(state)) return c.json({ error: 'invalid_input' }, 400);
      const base = body?.baseVersion;
      if (base !== undefined && base !== null && !Number.isInteger(base)) return c.json({ error: 'invalid_input' }, 400);
      const userId = c.get('userId');

      // Insert if nothing is stored yet; otherwise update only if the client saw the latest version.
      const { rows } = await pool.query<StateRow>(
        `INSERT INTO user_state (user_id, state) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
           SET state = EXCLUDED.state, version = user_state.version + 1, updated_at = now()
           WHERE user_state.version = $3
         RETURNING state, version, updated_at`,
        [userId, JSON.stringify(state), base ?? -1],
      );
      if (rows[0]) return c.json(stateJson(rows[0]));

      const current = await pool.query<StateRow>('SELECT state, version, updated_at FROM user_state WHERE user_id = $1', [
        userId,
      ]);
      return c.json({ error: 'conflict', current: stateJson(current.rows[0]) }, 409);
    },
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
