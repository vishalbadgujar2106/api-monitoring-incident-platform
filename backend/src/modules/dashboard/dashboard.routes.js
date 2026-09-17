import { Router } from 'express';
import { getDashboardSummaryHandler } from './dashboard.controller.js';

const router = Router();

router.get('/summary', getDashboardSummaryHandler);

export default router;
