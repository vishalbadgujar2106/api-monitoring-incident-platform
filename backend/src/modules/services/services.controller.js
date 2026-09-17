import { asyncHandler } from '../../middleware/asyncHandler.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getRangeConfig, validateRange } from '../dashboard/dashboard.validation.js';
import { buildMetricsSeries } from '../dashboard/metricsBuckets.js';
import {
  findHealthChecksForServiceSince,
  findRecentHealthChecksForService,
} from '../healthChecks/healthChecks.repository.js';
import { findIncidentsByServiceId } from '../incidents/incidents.repository.js';
import { recordHealthCheck } from '../../worker/recordHealthCheck.js';
import {
  assertTimeoutFitsInterval,
  validateCreateService,
  validatePatchService,
  validateServiceId,
} from './services.validation.js';
import {
  createService,
  deleteService,
  findAllServices,
  findServiceById,
  findServiceDetail,
  updateService,
} from './services.repository.js';

export const createServiceHandler = asyncHandler(async (req, res) => {
  const data = validateCreateService(req.body);
  const service = await createService(data);
  res.status(201).json(service);
});

export const listServicesHandler = asyncHandler(async (req, res) => {
  const range = validateRange(req.query.range);
  const { windowSeconds } = getRangeConfig(range);
  const services = await findAllServices(windowSeconds);
  res.json(services);
});

export const getServiceHandler = asyncHandler(async (req, res) => {
  const id = validateServiceId(req.params.id);
  const range = validateRange(req.query.range);
  const rangeConfig = getRangeConfig(range);

  const service = await findServiceDetail(id, rangeConfig.windowSeconds);
  if (!service) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  const now = Date.now();
  const windowStart = new Date(now - rangeConfig.windowSeconds * 1000);

  const [healthChecksForSeries, recentHealthChecks, allIncidents] = await Promise.all([
    findHealthChecksForServiceSince(id, windowStart),
    findRecentHealthChecksForService(id, 20),
    findIncidentsByServiceId(id),
  ]);

  const incidentsInWindow = allIncidents.filter(
    (incident) => new Date(incident.startedAt).getTime() >= windowStart.getTime(),
  );

  const series = buildMetricsSeries({
    rangeConfig,
    now,
    healthChecks: healthChecksForSeries,
    incidents: incidentsInWindow,
  });

  res.json({
    ...service,
    range,
    series,
    recentHealthChecks,
    recentIncidents: allIncidents.slice(0, 10),
  });
});

export const patchServiceHandler = asyncHandler(async (req, res) => {
  const id = validateServiceId(req.params.id);
  const existing = await findServiceById(id);
  if (!existing) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  const fields = validatePatchService(req.body);

  assertTimeoutFitsInterval(
    fields.timeoutMs ?? existing.timeoutMs,
    fields.checkIntervalSeconds ?? existing.checkIntervalSeconds,
  );

  const updated = await updateService(id, fields);
  res.json(updated);
});

export const deleteServiceHandler = asyncHandler(async (req, res) => {
  const id = validateServiceId(req.params.id);
  const deleted = await deleteService(id);
  if (!deleted) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }
  res.status(204).send();
});

// Runs one real, on-demand probe through the same worker path the
// scheduler uses (checkRunner -> persist -> incident engine) — not a
// client-supplied result, just triggering the existing worker logic early.
// Works regardless of is_active/paused state and doesn't change it.
export const checkServiceNowHandler = asyncHandler(async (req, res) => {
  const id = validateServiceId(req.params.id);
  const service = await findServiceById(id);
  if (!service) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  const result = await recordHealthCheck(service);
  res.status(201).json(result);
});
