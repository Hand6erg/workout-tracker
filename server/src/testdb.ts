import pg from 'pg';

/** Fresh, empty schema for each test file, on the database in TEST_DATABASE_URL. */
export async function testPool(): Promise<{ pool: pg.Pool; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://loeft:loeft@localhost:5433/loeft_test';
  const schema = `t_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new pg.Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();
  const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public` });
  return {
    pool,
    close: async () => {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    },
  };
}
