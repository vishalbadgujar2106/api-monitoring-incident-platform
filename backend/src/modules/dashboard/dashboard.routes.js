import { Router } from 'express';
import { getDashboardMetricsHandler, getDashboardSummaryHandler } from './dashboard.controller.js';

const router = Router();

router.get('/summary', getDashboardSummaryHandler);
router.get('/metrics', getDashboardMetricsHandler);

export default router;
