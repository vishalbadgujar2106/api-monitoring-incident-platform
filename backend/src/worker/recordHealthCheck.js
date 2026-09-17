import { runHealthCheck } from './checkRunner.js';
import { createHealthCheck } from '../modules/healthChecks/healthChecks.repository.js';
import { updateServiceStatus } from '../modules/services/services.repository.js';
import { applyHealthCheckResult } from './incidentEngine.js';

/**
 * Runs a health check for one service and persists the outcome:
 * inserts a health_checks row, updates the service's current_status /
 * last_checked_at, and runs the incident engine (open/increment/resolve).
 * Returns the saved health_checks row.
 *
 * Does not decide *when* a service should be checked (scheduler concern).
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

  await applyHealthCheckResult({
    serviceId: service.id,
    status: result.status,
    checkedAt: result.checkedAt,
  });

  return savedCheck;
}
