// All SQL for the entries table. Every function takes userId first and every statement
// filters on user_id, so one user can never read or change another user's entries.
// `db` is the shared pool by default, or a transaction client from withTransaction().
import { pool } from '../db/pool.js';
import { assertUserId } from './assertUserId.js';

const COLUMNS = `id, content, entry_date AS "entryDate", created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listByUser(userId, db = pool) {
  assertUserId(userId);
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM entries
     WHERE user_id = $1
     ORDER BY entry_date DESC, created_at DESC`,
    [userId],
  );
  return rows;
}

export async function findById(userId, entryId, db = pool) {
  assertUserId(userId);
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM entries WHERE id = $1 AND user_id = $2`,
    [entryId, userId],
  );
  return rows[0] ?? null;
}

export async function create(userId, { content, entryDate }, db = pool) {
  assertUserId(userId);
  const { rows } = await db.query(
    `INSERT INTO entries (user_id, content, entry_date)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNS}`,
    [userId, content, entryDate],
  );
  return rows[0];
}

// Returns null when no row matched: the entry does not exist OR belongs to someone else.
export async function update(userId, entryId, { content, entryDate }, db = pool) {
  assertUserId(userId);
  const { rows } = await db.query(
    `UPDATE entries
     SET content = $3, entry_date = $4, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${COLUMNS}`,
    [entryId, userId, content, entryDate],
  );
  return rows[0] ?? null;
}

// The entry's chunks are removed by ON DELETE CASCADE in the same statement.
export async function remove(userId, entryId, db = pool) {
  assertUserId(userId);
  const { rowCount } = await db.query(`DELETE FROM entries WHERE id = $1 AND user_id = $2`, [
    entryId,
    userId,
  ]);
  return rowCount > 0;
}
