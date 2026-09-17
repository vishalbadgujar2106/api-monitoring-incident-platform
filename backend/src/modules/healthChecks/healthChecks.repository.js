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
