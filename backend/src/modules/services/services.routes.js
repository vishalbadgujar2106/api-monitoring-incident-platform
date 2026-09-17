import { Router } from 'express';
import {
  checkServiceNowHandler,
  createServiceHandler,
  deleteServiceHandler,
  getServiceHandler,
  listServicesHandler,
  patchServiceHandler,
} from './services.controller.js';

const router = Router();

router.post('/', createServiceHandler);
router.get('/', listServicesHandler);
router.get('/:id', getServiceHandler);
router.patch('/:id', patchServiceHandler);
router.delete('/:id', deleteServiceHandler);
router.post('/:id/check', checkServiceNowHandler);

export default router;
