import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { testPool } from './testdb.js';

let db: Awaited<ReturnType<typeof testPool>>;
beforeAll(async () => (db = await testPool()));
afterAll(async () => db.close());

const config = loadConfig({ DATABASE_URL: 'unused', JWT_SECRET: 'x'.repeat(32), CORS_ORIGINS: 'https://example.com' });

it('GET /health reports ok when the database answers', async () => {
  const res = await createApp(db.pool, config).request('/health');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

it('allows CORS only from configured origins', async () => {
  const app = createApp(db.pool, config);
  const ok = await app.request('/health', { headers: { Origin: 'https://example.com' } });
  expect(ok.headers.get('access-control-allow-origin')).toBe('https://example.com');
  const no = await app.request('/health', { headers: { Origin: 'https://evil.example' } });
  expect(no.headers.get('access-control-allow-origin')).toBeNull();
});

it('refuses to start with a short JWT secret', () => {
  expect(() => loadConfig({ DATABASE_URL: 'x', JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
});
