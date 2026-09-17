import { Router } from 'express';
import { analyzeIncidentHandler, getIncidentHandler, listIncidentsHandler } from './incidents.controller.js';

const router = Router();

router.get('/', listIncidentsHandler);
router.get('/:id', getIncidentHandler);
router.post('/:id/analyze', analyzeIncidentHandler);

export default router;
