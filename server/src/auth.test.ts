import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { hashPassword, RateLimiter, signToken, TOKEN_TTL_SECONDS, verifyPassword, verifyToken } from './auth.js';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';
import { testPool } from './testdb.js';

const SECRET = 's'.repeat(32);
const config = loadConfig({ DATABASE_URL: 'unused', JWT_SECRET: SECRET });

let db: Awaited<ReturnType<typeof testPool>>;
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  db = await testPool();
  await migrate(db.pool, fileURLToPath(new URL('../migrations', import.meta.url)));
  app = createApp(db.pool, config);
});
afterAll(async () => db.close());

const post = (path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('passwords and tokens', () => {
  it('hashes and verifies passwords', async () => {
    const h = await hashPassword('hemmelig123');
    expect(h).not.toContain('hemmelig123');
    expect(await verifyPassword('hemmelig123', h)).toBe(true);
    expect(await verifyPassword('forkert', h)).toBe(false);
  });

  it('rejects tampered, wrongly signed and expired tokens', () => {
    const t = signToken('u1', SECRET, 1000);
    expect(verifyToken(t, SECRET, 1001)).toBe('u1');
    expect(verifyToken(t, SECRET, 1000 + TOKEN_TTL_SECONDS)).toBeNull();
    expect(verifyToken(t, 'x'.repeat(32), 1001)).toBeNull();
    const [h, , s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9e9 })).toString('base64url');
    expect(verifyToken(`${h}.${forged}.${s}`, SECRET, 1001)).toBeNull();
    expect(verifyToken('nonsense', SECRET)).toBeNull();
  });

  it('rate limiter blocks after the limit and resets after the window', () => {
    const rl = new RateLimiter(2, 1000);
    expect([rl.hit('a', 0), rl.hit('a', 1), rl.hit('a', 2)]).toEqual([true, true, false]);
    expect(rl.hit('a', 1001)).toBe(true);
  });
});

describe('auth endpoints', () => {
  it('registers, logs in and reads /me', async () => {
    const reg = await post('/auth/register', { email: 'Ida@Example.com', password: 'langtkodeord' });
    expect(reg.status).toBe(201);
    const { token, user } = await reg.json();
    expect(user.email).toBe('ida@example.com');

    const me = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } });
    expect((await me.json()).user.email).toBe('ida@example.com');

    const login = await post('/auth/login', { email: 'IDA@example.com', password: 'langtkodeord' });
    expect(login.status).toBe(200);
    expect(verifyToken((await login.json()).token, SECRET)).toBe(user.id);
  });

  it('refuses duplicate email, short password and bad input', async () => {
    await post('/auth/register', { email: 'bo@example.com', password: 'langtkodeord' });
    expect((await post('/auth/register', { email: 'BO@example.com', password: 'langtkodeord' })).status).toBe(409);
    expect((await post('/auth/register', { email: 'ny@example.com', password: 'kort' })).status).toBe(400);
    expect((await post('/auth/register', { email: 'ikke-en-mail', password: 'langtkodeord' })).status).toBe(400);
  });

  it('gives the same answer for wrong password and unknown email', async () => {
    await post('/auth/register', { email: 'al@example.com', password: 'langtkodeord' });
    const wrong = await post('/auth/login', { email: 'al@example.com', password: 'forkertkode' });
    const unknown = await post('/auth/login', { email: 'findes@ikke.dk', password: 'forkertkode' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('blocks /me without a valid token', async () => {
    expect((await app.request('/me')).status).toBe(401);
    expect((await app.request('/me', { headers: { Authorization: 'Bearer abc' } })).status).toBe(401);
  });

  it('limits login attempts per email', async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await post('/auth/login', { email: 'mal@example.com', password: 'x'.repeat(8) })).status;
    expect(last).toBe(429);
  });
});
