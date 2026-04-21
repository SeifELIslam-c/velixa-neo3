import { firebaseAuth } from './firebase';

const API_PREFIX = '/api';

export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  const user = firebaseAuth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error ?? 'API request failed');
  }

  return payload as T;
}
