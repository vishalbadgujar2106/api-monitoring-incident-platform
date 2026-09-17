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

const LIST_SELECT = `
  i.id,
  i.service_id AS "serviceId",
  i.status,
  i.started_at AS "startedAt",
  i.resolved_at AS "resolvedAt",
  i.failure_count AS "failureCount",
  i.root_cause_summary AS "rootCauseSummary",
  i.suggested_steps AS "suggestedSteps",
  i.created_at AS "createdAt",
  i.updated_at AS "updatedAt",
  json_build_object(
    'id', s.id,
    'name', s.name,
    'currentStatus', s.current_status
  ) AS service
`;

const DETAIL_SELECT = `
  i.id,
  i.service_id AS "serviceId",
  i.status,
  i.started_at AS "startedAt",
  i.resolved_at AS "resolvedAt",
  i.failure_count AS "failureCount",
  i.root_cause_summary AS "rootCauseSummary",
  i.suggested_steps AS "suggestedSteps",
  i.created_at AS "createdAt",
  i.updated_at AS "updatedAt",
  json_build_object(
    'id', s.id,
    'name', s.name,
    'url', s.url,
    'method', s.method,
    'expectedStatus', s.expected_status,
    'checkIntervalSeconds', s.check_interval_seconds,
    'timeoutMs', s.timeout_ms,
    'isActive', s.is_active,
    'currentStatus', s.current_status,
    'lastCheckedAt', s.last_checked_at
  ) AS service
`;

export async function findAllIncidents({ status } = {}) {
  const params = [];
  let whereClause = '';

  if (status) {
    params.push(status);
    whereClause = `WHERE i.status = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT ${LIST_SELECT}
     FROM incidents i
     JOIN services s ON s.id = i.service_id
     ${whereClause}
     ORDER BY i.started_at DESC`,
    params,
  );
  return rows;
}

export async function findIncidentById(id) {
  const { rows } = await pool.query(
    `SELECT ${DETAIL_SELECT}
     FROM incidents i
     JOIN services s ON s.id = i.service_id
     WHERE i.id = $1`,
    [id],
  );
  return rows[0] || null;
}

// Full incident history for one service, newest first — used by the
// service detail view (recent incidents list + windowed for the trend
// chart's incident-count buckets).
export async function findIncidentsByServiceId(serviceId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM incidents
     WHERE service_id = $1
     ORDER BY started_at DESC`,
    [serviceId],
  );
  return rows;
}

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
