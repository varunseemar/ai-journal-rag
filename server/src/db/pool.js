import pg from 'pg';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Postgres DATE (type OID 1082) -> keep it as the 'YYYY-MM-DD' string.
// By default pg builds a JS Date at local midnight, which can display as the previous day.
pg.types.setTypeParser(1082, (value) => value);

// One shared pool for the whole app. Neon's pooled endpoint (PgBouncer) sits in front of it.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Neon's free compute sleeps when idle; the first connection can take a moment to wake it.
  connectionTimeoutMillis: 15_000,
});

// Neon closes idle connections; without this listener that error would crash the process.
pool.on('error', (err) => log.warn('Idle Postgres client error', { message: err.message }));

// Runs fn(client) inside BEGIN/COMMIT. Any error rolls everything back.
// Each transaction holds one client, which is what SET LOCAL needs behind a transaction-mode pooler.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
