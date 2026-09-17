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

// Read-path columns enriched with derived, per-service analytics:
// lastResponseTimeMs (most recent health check) and uptimePercent (over a
// caller-supplied window). These can't be produced by an INSERT/UPDATE
// RETURNING clause (no joins there), so they're only used by the two read
// functions below, not by createService/updateService/updateServiceStatus.
const ENRICHED_SELECT_COLUMNS = `
  s.id,
  s.name,
  s.url,
  s.method,
  s.expected_status AS "expectedStatus",
  s.check_interval_seconds AS "checkIntervalSeconds",
  s.timeout_ms AS "timeoutMs",
  s.is_active AS "isActive",
  s.current_status AS "currentStatus",
  s.last_checked_at AS "lastCheckedAt",
  s.created_at AS "createdAt",
  s.updated_at AS "updatedAt",
  latest.response_time_ms AS "lastResponseTimeMs",
  uptime.uptime_percent AS "uptimePercent"
`;

const LATEST_RESPONSE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT response_time_ms
    FROM health_checks hc
    WHERE hc.service_id = s.id
    ORDER BY hc.checked_at DESC
    LIMIT 1
  ) latest ON true
`;

// $1 is always windowSeconds in both callers below.
const UPTIME_JOIN = `
  LEFT JOIN LATERAL (
    SELECT ROUND((COUNT(*) FILTER (WHERE status = 'up')::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS uptime_percent
    FROM health_checks hc2
    WHERE hc2.service_id = s.id
      AND hc2.checked_at >= now() - make_interval(secs => $1)
  ) uptime ON true
`;

const DEFAULT_UPTIME_WINDOW_SECONDS = 24 * 60 * 60;

function normalizeEnrichedRow(row) {
  return {
    ...row,
    uptimePercent: row.uptimePercent === null ? null : Number(row.uptimePercent),
  };
}

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

// List/detail read paths: enriched with lastResponseTimeMs and
// uptimePercent (computed over the last `windowSeconds`).
export async function findAllServices(windowSeconds = DEFAULT_UPTIME_WINDOW_SECONDS) {
  const { rows } = await pool.query(
    `SELECT ${ENRICHED_SELECT_COLUMNS}
     FROM services s
     ${LATEST_RESPONSE_JOIN}
     ${UPTIME_JOIN}
     ORDER BY s.created_at DESC`,
    [windowSeconds],
  );
  return rows.map(normalizeEnrichedRow);
}

export async function findServiceDetail(id, windowSeconds = DEFAULT_UPTIME_WINDOW_SECONDS) {
  const { rows } = await pool.query(
    `SELECT ${ENRICHED_SELECT_COLUMNS}
     FROM services s
     ${LATEST_RESPONSE_JOIN}
     ${UPTIME_JOIN}
     WHERE s.id = $2`,
    [windowSeconds, id],
  );
  return rows[0] ? normalizeEnrichedRow(rows[0]) : null;
}

// Lean/internal read path: no derived analytics, used wherever code just
// needs to confirm a service exists or read its raw config (e.g. the PATCH
// handler's existence + cross-field validation check).
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
