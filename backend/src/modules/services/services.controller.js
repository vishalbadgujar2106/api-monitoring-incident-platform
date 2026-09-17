import { asyncHandler } from '../../middleware/asyncHandler.js';
import { AppError } from '../../middleware/errorHandler.js';
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
  updateService,
} from './services.repository.js';

export const createServiceHandler = asyncHandler(async (req, res) => {
  const data = validateCreateService(req.body);
  const service = await createService(data);
  res.status(201).json(service);
});

export const listServicesHandler = asyncHandler(async (req, res) => {
  const services = await findAllServices();
  res.json(services);
});

export const getServiceHandler = asyncHandler(async (req, res) => {
  const id = validateServiceId(req.params.id);
  const service = await findServiceById(id);
  if (!service) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }
  res.json(service);
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
