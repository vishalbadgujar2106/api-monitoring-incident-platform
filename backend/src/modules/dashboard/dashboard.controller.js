import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  findHealthChecksSince,
  findIncidentsStartedSince,
  getDashboardSummary,
} from './dashboard.repository.js';
import { getRangeConfig, validateRange } from './dashboard.validation.js';
import { buildMetricsSeries } from './metricsBuckets.js';

export const getDashboardSummaryHandler = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary();
  res.json(summary);
});

export const getDashboardMetricsHandler = asyncHandler(async (req, res) => {
  const range = validateRange(req.query.range);
  const rangeConfig = getRangeConfig(range);
  const now = Date.now();
  const windowStart = new Date(now - rangeConfig.windowSeconds * 1000);

  const [healthChecks, incidents] = await Promise.all([
    findHealthChecksSince(windowStart),
    findIncidentsStartedSince(windowStart),
  ]);

  const series = buildMetricsSeries({ rangeConfig, now, healthChecks, incidents });

  res.json({
    range,
    bucketSeconds: rangeConfig.bucketSeconds,
    bucketCount: series.length,
    generatedAt: new Date(now).toISOString(),
    series,
  });
});
