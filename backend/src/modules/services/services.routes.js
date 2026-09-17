import { Router } from 'express';
import {
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

export default router;
