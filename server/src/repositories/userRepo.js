import { pool } from '../db/pool.js';

export async function create(email, passwordHash) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email`,
    [email, passwordHash],
  );
  return rows[0];
}

// The only query that returns password_hash; used by login and nowhere else.
export async function findByEmailWithHash(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash AS "passwordHash" FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
