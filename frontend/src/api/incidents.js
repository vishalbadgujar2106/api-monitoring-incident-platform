import { get } from './client.js';

export function listIncidents(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return get(`/api/incidents${query}`);
}
