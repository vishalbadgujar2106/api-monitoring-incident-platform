import { asyncHandler } from '../../middleware/asyncHandler.js';
import { getDashboardSummary } from './dashboard.repository.js';

export const getDashboardSummaryHandler = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary();
  res.json(summary);
});
