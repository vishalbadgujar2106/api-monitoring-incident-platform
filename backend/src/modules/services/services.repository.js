import pool from '../../config/db.js';

const SELECT_COLUMNS = `
  id,
  name,
  url,
  method,
  expected_status AS "expectedStatus",
  check_interval_seconds AS "checkIntervalSeconds",
  timeout_ms AS "timeoutMs",
  is_active AS "isActive",
  current_status AS "currentStatus",
  last_checked_at AS "lastCheckedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const PATCHABLE_COLUMNS = {
  name: 'name',
  url: 'url',
  method: 'method',
  expectedStatus: 'expected_status',
  checkIntervalSeconds: 'check_interval_seconds',
  timeoutMs: 'timeout_ms',
  isActive: 'is_active',
};

export async function createService({
  name,
  url,
  method,
  expectedStatus,
  checkIntervalSeconds,
  timeoutMs,
  isActive,
}) {
  const { rows } = await pool.query(
    `INSERT INTO services (name, url, method, expected_status, check_interval_seconds, timeout_ms, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SELECT_COLUMNS}`,
    [name, url, method, expectedStatus, checkIntervalSeconds, timeoutMs, isActive],
  );
  return rows[0];
}

export async function findAllServices() {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM services ORDER BY created_at DESC`,
  );
  return rows;
}

export async function findServiceById(id) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM services WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

// Worker-only read path: services that are active and past their own
// check_interval_seconds since the last check (or never checked yet).
export async function findDueServices() {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM services
     WHERE is_active = true
       AND (last_checked_at IS NULL OR last_checked_at < now() - make_interval(secs => check_interval_seconds))
     ORDER BY last_checked_at NULLS FIRST`,
  );
  return rows;
}

export async function updateService(id, fields) {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, column] of Object.entries(PATCHABLE_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      setClauses.push(`${column} = $${paramIndex}`);
      values.push(fields[key]);
      paramIndex += 1;
    }
  }

  if (setClauses.length === 0) {
    return findServiceById(id);
  }

  setClauses.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE services SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING ${SELECT_COLUMNS}`,
    values,
  );
  return rows[0] || null;
}

// Worker-only write path: current_status/last_checked_at are derived from
// health checks and are intentionally excluded from PATCHABLE_COLUMNS so
// the public API can never set them directly.
export async function updateServiceStatus(id, { currentStatus, lastCheckedAt }) {
  const { rows } = await pool.query(
    `UPDATE services
     SET current_status = $1, last_checked_at = $2, updated_at = now()
     WHERE id = $3
     RETURNING ${SELECT_COLUMNS}`,
    [currentStatus, lastCheckedAt, id],
  );
  return rows[0] || null;
}

export async function deleteService(id) {
  const { rows } = await pool.query(
    'DELETE FROM services WHERE id = $1 RETURNING id',
    [id],
  );
  return rows[0] || null;
}
