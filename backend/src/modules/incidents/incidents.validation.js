import { AppError } from '../../middleware/errorHandler.js';

const ALLOWED_STATUSES = ['open', 'resolved'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validationError(message) {
  return new AppError(message, 400, 'VALIDATION_ERROR');
}

export function validateIncidentStatusFilter(status) {
  if (status === undefined) return undefined;
  if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
    throw validationError(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }
  return status;
}

export function validateIncidentId(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw validationError('id must be a valid UUID');
  }
  return id;
}
