// npm run db:migrate -> applies schema.sql to the database in DATABASE_URL.
import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  const { rows } = await pool.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
  console.log(`Schema applied. pgvector version: ${rows[0]?.extversion ?? 'not installed'}`);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
