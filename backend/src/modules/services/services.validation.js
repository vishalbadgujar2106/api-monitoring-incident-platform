import { AppError } from '../../middleware/errorHandler.js';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validationError(message) {
  return new AppError(message, 400, 'VALIDATION_ERROR');
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateName(value, { required }) {
  if (value === undefined) {
    if (required) throw validationError('name is required');
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) {
    throw validationError('name must be a non-empty string of at most 255 characters');
  }
  return value.trim();
}

function validateUrl(value, { required }) {
  if (value === undefined) {
    if (required) throw validationError('url is required');
    return undefined;
  }
  if (typeof value !== 'string') {
    throw validationError('url must be a string');
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw validationError('url must be a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw validationError('url must use the http:// or https:// scheme');
  }
  return value;
}

function validateMethod(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !ALLOWED_METHODS.includes(value.toUpperCase())) {
    throw validationError(`method must be one of: ${ALLOWED_METHODS.join(', ')}`);
  }
  return value.toUpperCase();
}

function validateExpectedStatus(value) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 100 || value > 599) {
    throw validationError('expected_status must be an integer between 100 and 599');
  }
  return value;
}

function validateCheckIntervalSeconds(value) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 10 || value > 86400) {
    throw validationError('check_interval_seconds must be an integer between 10 and 86400');
  }
  return value;
}

function validateTimeoutMs(value) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 100 || value > 30000) {
    throw validationError('timeout_ms must be an integer between 100 and 30000');
  }
  return value;
}

function validateIsActive(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw validationError('is_active must be a boolean');
  }
  return value;
}

function assertTimeoutFitsInterval(timeoutMs, checkIntervalSeconds) {
  if (timeoutMs >= checkIntervalSeconds * 1000) {
    throw validationError('timeout_ms must be less than check_interval_seconds expressed in milliseconds');
  }
}

export function validateCreateService(body) {
  if (!isPlainObject(body)) {
    throw validationError('Request body must be a JSON object');
  }

  const name = validateName(body.name, { required: true });
  const url = validateUrl(body.url, { required: true });
  const method = validateMethod(body.method) ?? 'GET';
  const expectedStatus = validateExpectedStatus(body.expected_status) ?? 200;
  const checkIntervalSeconds = validateCheckIntervalSeconds(body.check_interval_seconds) ?? 60;
  const timeoutMs = validateTimeoutMs(body.timeout_ms) ?? 5000;
  const isActive = validateIsActive(body.is_active) ?? true;

  assertTimeoutFitsInterval(timeoutMs, checkIntervalSeconds);

  return { name, url, method, expectedStatus, checkIntervalSeconds, timeoutMs, isActive };
}

export function validatePatchService(body) {
  if (!isPlainObject(body)) {
    throw validationError('Request body must be a JSON object');
  }

  const fields = {};

  const name = validateName(body.name, { required: false });
  if (name !== undefined) fields.name = name;

  const url = validateUrl(body.url, { required: false });
  if (url !== undefined) fields.url = url;

  const method = validateMethod(body.method);
  if (method !== undefined) fields.method = method;

  const expectedStatus = validateExpectedStatus(body.expected_status);
  if (expectedStatus !== undefined) fields.expectedStatus = expectedStatus;

  const checkIntervalSeconds = validateCheckIntervalSeconds(body.check_interval_seconds);
  if (checkIntervalSeconds !== undefined) fields.checkIntervalSeconds = checkIntervalSeconds;

  const timeoutMs = validateTimeoutMs(body.timeout_ms);
  if (timeoutMs !== undefined) fields.timeoutMs = timeoutMs;

  const isActive = validateIsActive(body.is_active);
  if (isActive !== undefined) fields.isActive = isActive;

  if (Object.keys(fields).length === 0) {
    throw validationError('At least one field must be provided to update');
  }

  return fields;
}

export function validateServiceId(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw validationError('id must be a valid UUID');
  }
  return id;
}

export { assertTimeoutFitsInterval };
