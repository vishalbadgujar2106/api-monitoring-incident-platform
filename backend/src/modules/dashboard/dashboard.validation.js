import { AppError } from '../../middleware/errorHandler.js';

// Bucket widths are chosen so windowSeconds / bucketSeconds is always a
// whole number, giving each range a fixed, predictable bucket count.
const RANGE_CONFIG = {
  '1h': { windowSeconds: 60 * 60, bucketSeconds: 5 * 60 }, // 12 buckets
  '6h': { windowSeconds: 6 * 60 * 60, bucketSeconds: 15 * 60 }, // 24 buckets
  '24h': { windowSeconds: 24 * 60 * 60, bucketSeconds: 60 * 60 }, // 24 buckets
  '7d': { windowSeconds: 7 * 24 * 60 * 60, bucketSeconds: 6 * 60 * 60 }, // 28 buckets
};

const DEFAULT_RANGE = '24h';

export function validateRange(range) {
  if (range === undefined) return DEFAULT_RANGE;
  if (typeof range !== 'string' || !RANGE_CONFIG[range]) {
    throw new AppError(
      `range must be one of: ${Object.keys(RANGE_CONFIG).join(', ')}`,
      400,
      'VALIDATION_ERROR',
    );
  }
  return range;
}

export function getRangeConfig(range) {
  return RANGE_CONFIG[range];
}
