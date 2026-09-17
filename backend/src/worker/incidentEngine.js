import {
  createIncident,
  findOpenIncidentByServiceId,
  incrementIncidentFailureCount,
  resolveIncident,
} from '../modules/incidents/incidents.repository.js';

/**
 * Decides what should happen to a service's incident state given the
 * outcome of one health check, and applies it. Contains no SQL itself —
 * all persistence goes through incidents.repository.js.
 *
 * Rules (V1, threshold = 1 failed check):
 * - down, no open incident      -> open a new incident (failure_count = 1)
 * - down, open incident exists  -> increment its failure_count
 * - up,   open incident exists  -> resolve it (resolved_at = checkedAt)
 * - up,   no open incident      -> no-op
 *
 * "One open incident per service" is enforced here by always looking up
 * the current open incident before deciding, rather than via a DB
 * constraint.
 *
 * @param {{ serviceId: string, status: 'up'|'down', checkedAt: Date }} params
 * @returns {Promise<object|null>} the created/updated incident, or null when nothing changed
 */
export async function applyHealthCheckResult({ serviceId, status, checkedAt }) {
  const openIncident = await findOpenIncidentByServiceId(serviceId);

  if (status === 'down') {
    if (!openIncident) {
      return createIncident({ serviceId, startedAt: checkedAt });
    }
    return incrementIncidentFailureCount(openIncident.id);
  }

  if (openIncident) {
    return resolveIncident(openIncident.id, checkedAt);
  }

  return null;
}
