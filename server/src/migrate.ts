import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';

/**
 * Runs every `*.sql` file in `dir` that hasn't run before, in name order.
 * Each file runs in its own transaction and is recorded in `migrations`.
 * An advisory lock keeps two API instances from migrating at the same time.
 */
export async function migrate(pool: pg.Pool, dir: string): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, ran_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM migrations')).rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const ran: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
  }
}
