import pool from '../../config/db.js';

const SELECT_COLUMNS = `
  id,
  service_id AS "serviceId",
  status,
  status_code AS "statusCode",
  response_time_ms AS "responseTimeMs",
  error_message AS "errorMessage",
  checked_at AS "checkedAt"
`;

export async function createHealthCheck({
  serviceId,
  status,
  statusCode,
  responseTimeMs,
  errorMessage,
  checkedAt,
}) {
  const { rows } = await pool.query(
    `INSERT INTO health_checks (service_id, status, status_code, response_time_ms, error_message, checked_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_COLUMNS}`,
    [serviceId, status, statusCode, responseTimeMs, errorMessage, checkedAt],
  );
  return rows[0];
}

// Returns health checks for one service within a window around an
// incident's failure period (started_at..resolved_at, or ..now() if still
// open), padded on both sides so the surrounding "healthy" checks are
// visible too.
export async function findHealthChecksAroundWindow({ serviceId, startedAt, resolvedAt, limit = 50 }) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM health_checks
     WHERE service_id = $1
       AND checked_at BETWEEN $2::timestamptz - interval '15 minutes'
                          AND COALESCE($3::timestamptz, now()) + interval '15 minutes'
     ORDER BY checked_at ASC
     LIMIT $4`,
    [serviceId, startedAt, resolvedAt, limit],
  );
  return rows;
}
