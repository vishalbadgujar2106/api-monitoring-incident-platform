import { useState } from 'react';

const MAX_POINTS = 40;

/**
 * Accumulates a rolling, session-local history of dashboard summary
 * snapshots as they arrive from polling. This is real polled data, not a
 * server-provided time series (the API has none) — history starts empty
 * on load and grows as the session runs.
 *
 * `updatedAt` comes from usePolling's lastUpdatedAt (captured outside of
 * render, inside its fetch callback), so this hook never calls Date.now()
 * itself and stays pure during render.
 */
export function useMetricHistory(summary, updatedAt) {
  const [history, setHistory] = useState([]);
  const [trackedAt, setTrackedAt] = useState(null);

  if (summary && updatedAt && updatedAt !== trackedAt) {
    setTrackedAt(updatedAt);

    const snapshot = {
      at: updatedAt,
      totalServices: summary.totalServices,
      upServices: summary.upServices,
      downServices: summary.downServices,
      openIncidents: summary.openIncidents,
      averageUptime24h: summary.averageUptime24h,
    };

    setHistory((prev) => {
      const next = [...prev, snapshot];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }

  return history;
}
