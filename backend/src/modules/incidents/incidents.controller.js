import { asyncHandler } from '../../middleware/asyncHandler.js';
import { AppError } from '../../middleware/errorHandler.js';
import { findHealthChecksAroundWindow } from '../healthChecks/healthChecks.repository.js';
import { analyzeIncident } from './incidentAnalysis.service.js';
import { findAllIncidents, findIncidentById } from './incidents.repository.js';
import { validateIncidentId, validateIncidentStatusFilter } from './incidents.validation.js';

export const listIncidentsHandler = asyncHandler(async (req, res) => {
  const status = validateIncidentStatusFilter(req.query.status);
  const incidents = await findAllIncidents({ status });
  res.json(incidents);
});

export const getIncidentHandler = asyncHandler(async (req, res) => {
  const id = validateIncidentId(req.params.id);
  const incident = await findIncidentById(id);
  if (!incident) {
    throw new AppError('Incident not found', 404, 'INCIDENT_NOT_FOUND');
  }

  const healthChecks = await findHealthChecksAroundWindow({
    serviceId: incident.serviceId,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
  });

  res.json({ ...incident, healthChecks });
});

export const analyzeIncidentHandler = asyncHandler(async (req, res) => {
  const id = validateIncidentId(req.params.id);
  const incident = await findIncidentById(id);
  if (!incident) {
    throw new AppError('Incident not found', 404, 'INCIDENT_NOT_FOUND');
  }

  const healthChecks = await findHealthChecksAroundWindow({
    serviceId: incident.serviceId,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
  });

  // V1: AI analysis is generated on demand and returned directly — it is
  // never written to Postgres, so the incident record itself is untouched.
  const { rootCauseSummary, suggestedSteps } = await analyzeIncident({ incident, healthChecks });

  res.json({ ...incident, rootCauseSummary, suggestedSteps, healthChecks });
});
