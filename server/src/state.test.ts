import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';
import { testPool } from './testdb.js';

const config = loadConfig({ DATABASE_URL: 'unused', JWT_SECRET: 's'.repeat(32) });
let db: Awaited<ReturnType<typeof testPool>>;
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  db = await testPool();
  await migrate(db.pool, fileURLToPath(new URL('../migrations', import.meta.url)));
  app = createApp(db.pool, config);
});
afterAll(async () => db.close());

async function account(email: string): Promise<string> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'langtkodeord' }),
  });
  return (await res.json()).token;
}
const get = (token: string) => app.request('/state', { headers: { Authorization: `Bearer ${token}` } });
const put = (token: string, body: unknown) =>
  app.request('/state', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('/state', () => {
  it('saves the first version, then updates with the right base version', async () => {
    const t = await account('a@example.com');
    expect((await get(t)).status).toBe(404);

    const first = await put(t, { state: { history: [1] } });
    expect(first.status).toBe(200);
    expect((await first.json()).version).toBe(1);

    const second = await put(t, { state: { history: [1, 2] }, baseVersion: 1 });
    expect((await second.json()).version).toBe(2);
    expect(await (await get(t)).json()).toMatchObject({ state: { history: [1, 2] }, version: 2 });
  });

  it('returns 409 with the current data when the base version is stale', async () => {
    const t = await account('b@example.com');
    await put(t, { state: { n: 1 } });
    await put(t, { state: { n: 2 }, baseVersion: 1 });
    const stale = await put(t, { state: { n: 'old' }, baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'conflict', current: { state: { n: 2 }, version: 2 } });
    // Without a base version an existing state is never overwritten
    expect((await put(t, { state: { n: 'x' } })).status).toBe(409);
  });

  it('keeps users apart', async () => {
    const a = await account('c@example.com');
    const b = await account('d@example.com');
    await put(a, { state: { owner: 'c' } });
    expect((await get(b)).status).toBe(404);
    await put(b, { state: { owner: 'd' } });
    expect((await (await get(a)).json()).state).toEqual({ owner: 'c' });
  });

  it('rejects bad input, missing token and huge bodies', async () => {
    const t = await account('e@example.com');
    expect((await put(t, { state: [1, 2] })).status).toBe(400);
    expect((await put(t, { state: { a: 1 }, baseVersion: 'x' })).status).toBe(400);
    expect((await app.request('/state')).status).toBe(401);
    expect((await put(t, { state: { big: 'x'.repeat(6 * 1024 * 1024) } })).status).toBe(413);
  });
});
