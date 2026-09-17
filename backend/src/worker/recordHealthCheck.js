import { runHealthCheck } from './checkRunner.js';
import { createHealthCheck } from '../modules/healthChecks/healthChecks.repository.js';
import { updateServiceStatus } from '../modules/services/services.repository.js';

/**
 * Runs a health check for one service and persists the outcome:
 * inserts a health_checks row and updates the service's current_status /
 * last_checked_at. Returns the saved health_checks row.
 *
 * Does not decide *when* a service should be checked (scheduler concern,
 * not yet implemented) and does not open/resolve incidents (incident
 * engine, not yet implemented).
 *
 * @param {{ id: string, url: string, method?: string, expectedStatus?: number, timeoutMs?: number }} service
 */
export async function recordHealthCheck(service) {
  const result = await runHealthCheck(service);

  const savedCheck = await createHealthCheck({
    serviceId: service.id,
    status: result.status,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    errorMessage: result.errorMessage,
    checkedAt: result.checkedAt,
  });

  await updateServiceStatus(service.id, {
    currentStatus: result.status,
    lastCheckedAt: result.checkedAt,
  });

  return savedCheck;
}
