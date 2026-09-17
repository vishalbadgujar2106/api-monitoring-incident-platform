import { get } from './client.js';

export function getDashboardSummary() {
  return get('/api/dashboard/summary');
}

export function getDashboardMetrics(range) {
  return get(`/api/dashboard/metrics?range=${encodeURIComponent(range)}`);
}
