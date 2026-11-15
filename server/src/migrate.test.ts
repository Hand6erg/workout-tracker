import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';
import { testPool } from './testdb.js';

let db: Awaited<ReturnType<typeof testPool>>;
beforeAll(async () => (db = await testPool()));
afterAll(async () => db.close());

describe('migrate', () => {
  it('runs new files once, in order', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mig-'));
    await writeFile(join(dir, '002_b.sql'), 'INSERT INTO t (v) VALUES (2);');
    await writeFile(join(dir, '001_a.sql'), 'CREATE TABLE t (v int); INSERT INTO t (v) VALUES (1);');
    expect(await migrate(db.pool, dir)).toEqual(['001_a.sql', '002_b.sql']);
    expect(await migrate(db.pool, dir)).toEqual([]);
    expect((await db.pool.query('SELECT v FROM t ORDER BY v')).rows).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('rolls back a failing file and reports it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mig-'));
    await writeFile(join(dir, '001_bad.sql'), 'CREATE TABLE half (v int); SELECT nope;');
    await expect(migrate(db.pool, dir)).rejects.toThrow('Migration 001_bad.sql failed');
    expect((await db.pool.query("SELECT to_regclass('half') AS t")).rows[0].t).toBeNull();
  });

  it('runs the real migrations', async () => {
    await migrate(db.pool, fileURLToPath(new URL('../migrations', import.meta.url)));
  });
});
