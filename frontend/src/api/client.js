const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = body?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export function get(path) {
  return request(path);
}

export function post(path, data) {
  return request(path, { method: 'POST', body: JSON.stringify(data) });
}

export function patch(path, data) {
  return request(path, { method: 'PATCH', body: JSON.stringify(data) });
}

export function del(path) {
  return request(path, { method: 'DELETE' });
}
