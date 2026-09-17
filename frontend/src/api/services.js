import { del, get, patch, post } from './client.js';

export function listServices(range) {
  const query = range ? `?range=${encodeURIComponent(range)}` : '';
  return get(`/api/services${query}`);
}

export function getService(id, range) {
  const query = range ? `?range=${encodeURIComponent(range)}` : '';
  return get(`/api/services/${id}${query}`);
}

export function createService(payload) {
  return post('/api/services', payload);
}

export function updateService(id, payload) {
  return patch(`/api/services/${id}`, payload);
}

export function deleteService(id) {
  return del(`/api/services/${id}`);
}

export function checkServiceNow(id) {
  return post(`/api/services/${id}/check`);
}
