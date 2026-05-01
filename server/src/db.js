import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

export async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for persistent server mode');
  }
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    // eslint-disable-next-line no-await-in-loop
    await pool.query(sql);
  }
}

export async function getPricing() {
  const r = await pool.query('SELECT value_json FROM pricing WHERE key = $1', ['pricing']);
  return r.rows?.[0]?.value_json;
}

export async function setPricing(valueJson) {
  await pool.query(
    'INSERT INTO pricing(key, value_json, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT(key) DO UPDATE SET value_json=EXCLUDED.value_json, updated_at=NOW()',
    ['pricing', valueJson]
  );
}

