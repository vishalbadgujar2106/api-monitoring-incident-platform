import pool from '../../config/db.js';

const SELECT_COLUMNS = `
  id,
  service_id AS "serviceId",
  status,
  started_at AS "startedAt",
  resolved_at AS "resolvedAt",
  failure_count AS "failureCount",
  root_cause_summary AS "rootCauseSummary",
  suggested_steps AS "suggestedSteps",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function findOpenIncidentByServiceId(serviceId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM incidents
     WHERE service_id = $1 AND status = 'open'
     ORDER BY started_at DESC
     LIMIT 1`,
    [serviceId],
  );
  return rows[0] || null;
}

export async function createIncident({ serviceId, startedAt }) {
  const { rows } = await pool.query(
    `INSERT INTO incidents (service_id, status, started_at, failure_count)
     VALUES ($1, 'open', $2, 1)
     RETURNING ${SELECT_COLUMNS}`,
    [serviceId, startedAt],
  );
  return rows[0];
}

export async function incrementIncidentFailureCount(id) {
  const { rows } = await pool.query(
    `UPDATE incidents
     SET failure_count = failure_count + 1, updated_at = now()
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [id],
  );
  return rows[0] || null;
}

export async function resolveIncident(id, resolvedAt) {
  const { rows } = await pool.query(
    `UPDATE incidents
     SET status = 'resolved', resolved_at = $2, updated_at = now()
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [id, resolvedAt],
  );
  return rows[0] || null;
}
