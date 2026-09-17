import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolling(fetcher, { intervalMs = 15000, key } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const load = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // `key` changing (e.g. a range selector) forces an immediate reload
  // instead of waiting for the next scheduled tick.
  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs, key]);

  return { data, error, isLoading, lastUpdatedAt, refresh: load };
}
