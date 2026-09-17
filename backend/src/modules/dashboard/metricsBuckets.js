function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Buckets raw health_checks/incidents rows into a fixed-width time series.
 * Pure function, no SQL/DB access — takes already-fetched rows and a
 * reference "now" so it stays deterministic and easy to test.
 *
 * Buckets are counted backward from `now` (not aligned to clock
 * boundaries), so the last bucket always ends exactly at `now` and the
 * count is always windowSeconds / bucketSeconds (guaranteed to be a whole
 * number for every supported range).
 *
 * @param {{ rangeConfig: { windowSeconds: number, bucketSeconds: number }, now: number, healthChecks: Array, incidents: Array }} params
 */
export function buildMetricsSeries({ rangeConfig, now, healthChecks, incidents }) {
  const { windowSeconds, bucketSeconds } = rangeConfig;
  const bucketMs = bucketSeconds * 1000;
  const bucketCount = windowSeconds / bucketSeconds;
  const firstBucketStartMs = now - bucketCount * bucketMs;

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    bucketStart: firstBucketStartMs + index * bucketMs,
    bucketEnd: firstBucketStartMs + (index + 1) * bucketMs,
    totalChecks: 0,
    upChecks: 0,
    failedChecks: 0,
    responseTimeSum: 0,
    responseTimeCount: 0,
    incidentCount: 0,
  }));

  function bucketIndexFor(timeMs) {
    const index = Math.floor((timeMs - firstBucketStartMs) / bucketMs);
    return index >= 0 && index < buckets.length ? index : null;
  }

  for (const check of healthChecks) {
    const index = bucketIndexFor(new Date(check.checkedAt).getTime());
    if (index === null) continue;

    const bucket = buckets[index];
    bucket.totalChecks += 1;
    if (check.status === 'up') bucket.upChecks += 1;
    if (check.status === 'down') bucket.failedChecks += 1;
    if (check.responseTimeMs !== null && check.responseTimeMs !== undefined) {
      bucket.responseTimeSum += check.responseTimeMs;
      bucket.responseTimeCount += 1;
    }
  }

  for (const incident of incidents) {
    const index = bucketIndexFor(new Date(incident.startedAt).getTime());
    if (index === null) continue;
    buckets[index].incidentCount += 1;
  }

  return buckets.map((bucket) => ({
    bucketStart: new Date(bucket.bucketStart).toISOString(),
    bucketEnd: new Date(bucket.bucketEnd).toISOString(),
    totalChecks: bucket.totalChecks,
    uptimePercent: bucket.totalChecks === 0 ? null : round2((bucket.upChecks / bucket.totalChecks) * 100),
    averageResponseTimeMs:
      bucket.responseTimeCount === 0 ? null : round2(bucket.responseTimeSum / bucket.responseTimeCount),
    failedChecks: bucket.failedChecks,
    incidentCount: bucket.incidentCount,
  }));
}
