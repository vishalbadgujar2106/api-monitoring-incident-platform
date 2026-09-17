import { Router } from 'express';
import { getIncidentHandler, listIncidentsHandler } from './incidents.controller.js';

const router = Router();

router.get('/', listIncidentsHandler);
router.get('/:id', getIncidentHandler);

export default router;
