function elapsedMs(startedAt) {
  const elapsedNs = process.hrtime.bigint() - startedAt;
  return Math.round(Number(elapsedNs) / 1e6);
}

function describeNetworkError(err) {
  const cause = err.cause ?? err;
  return cause.message || err.message || 'network error';
}

/**
 * Runs a single health check against one service record and returns a
 * normalized result. Never throws — all failure modes (wrong status,
 * timeout, DNS/connection errors) are captured in the returned object so
 * callers (the future scheduler) can persist the result unconditionally.
 *
 * @param {{ url: string, method?: string, expectedStatus?: number, timeoutMs?: number }} service
 * @returns {Promise<{ status: 'up'|'down', statusCode: number|null, responseTimeMs: number, errorMessage: string|null, checkedAt: Date }>}
 */
export async function runHealthCheck(service) {
  const { url, method = 'GET', expectedStatus = 200, timeoutMs = 5000 } = service;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = process.hrtime.bigint();

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
    });

    const responseTimeMs = elapsedMs(startedAt);
    const statusCode = response.status;

    if (statusCode === expectedStatus) {
      return {
        status: 'up',
        statusCode,
        responseTimeMs,
        errorMessage: null,
        checkedAt: new Date(),
      };
    }

    return {
      status: 'down',
      statusCode,
      responseTimeMs,
      errorMessage: `Expected status ${expectedStatus} but received ${statusCode}`,
      checkedAt: new Date(),
    };
  } catch (err) {
    const responseTimeMs = elapsedMs(startedAt);

    if (err.name === 'AbortError') {
      return {
        status: 'down',
        statusCode: null,
        responseTimeMs,
        errorMessage: 'timeout',
        checkedAt: new Date(),
      };
    }

    return {
      status: 'down',
      statusCode: null,
      responseTimeMs,
      errorMessage: describeNetworkError(err),
      checkedAt: new Date(),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
