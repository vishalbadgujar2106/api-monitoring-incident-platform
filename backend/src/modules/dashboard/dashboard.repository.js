import pool from '../../config/db.js';

export async function getDashboardSummary() {
  const [serviceCountsResult, incidentCountsResult, uptimeResult] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE current_status = 'up')::int AS up,
        COUNT(*) FILTER (WHERE current_status = 'down')::int AS down,
        COUNT(*) FILTER (WHERE current_status = 'unknown')::int AS unknown
      FROM services
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
      FROM incidents
    `),
    pool.query(`
      SELECT
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'up')::numeric / NULLIF(COUNT(*), 0)) * 100,
        2) AS average_uptime
      FROM health_checks
      WHERE checked_at >= now() - interval '24 hours'
    `),
  ]);

  const serviceCounts = serviceCountsResult.rows[0];
  const incidentCounts = incidentCountsResult.rows[0];
  const averageUptimeRaw = uptimeResult.rows[0].average_uptime;

  return {
    totalServices: serviceCounts.total,
    upServices: serviceCounts.up,
    downServices: serviceCounts.down,
    unknownServices: serviceCounts.unknown,
    openIncidents: incidentCounts.open,
    resolvedIncidents: incidentCounts.resolved,
    averageUptime24h: averageUptimeRaw === null ? null : Number(averageUptimeRaw),
  };
}
