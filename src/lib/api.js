import {auth} from '../firebase';

const VITE_ENV = import.meta.env || {};
export const API_URL = VITE_ENV.VITE_API_URL || 'http://localhost:5000/api';
const cache = new Map();
const pending = new Map();

function safeRequestPath(path) {
  return String(path || '').split('?')[0].slice(0, 200);
}

function e2eAuthHeaders() {
  if (!VITE_ENV.VITE_E2E_TEST_AUTH_SECRET) return {};
  const params = new URLSearchParams(window.location.search);
  const role = params.get('e2eRole') || VITE_ENV.VITE_E2E_TEST_ROLE || 'viewer';
  if (role === 'guest') return {};
  const playerId = params.get('e2ePlayerId') || VITE_ENV.VITE_E2E_TEST_PLAYER_ID || '';
  return {
    'X-E2E-Test-Token': VITE_ENV.VITE_E2E_TEST_AUTH_SECRET,
    'X-E2E-Test-Role': role,
    ...(playerId ? { 'X-E2E-Test-Player-Id': playerId } : {}),
  };
}

export class ApiError extends Error {
  constructor(message, {
    status = 0,
    method = 'GET',
    path = '',
    requestId = null,
    code = null,
    retryable = false,
    cause = undefined,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.method = String(method || 'GET').toUpperCase();
    this.path = safeRequestPath(path);
    this.requestId = requestId || null;
    this.code = code || null;
    this.retryable = Boolean(retryable);
  }

  toDiagnosticRecord() {
    return {
      name: this.name,
      status: this.status,
      method: this.method,
      path: this.path,
      requestId: this.requestId,
      code: this.code,
      retryable: this.retryable,
    };
  }
}

function genericMessageForStatus(status) {
  if (status === 401) return 'Your session may have expired. Please sign in again.';
  if (status === 403) return "You don't have permission to complete this action.";
  if (status === 404) return 'The requested item could not be found.';
  if (status === 408 || status === 504) return 'The request timed out. Please try again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return "The server couldn't complete this request.";
  return 'Could not complete this request.';
}

function requestIdFrom(response, data) {
  return response.headers?.get?.('x-request-id') || data?.requestId || null;
}

function logApiFailure(error, event = 'request_failed') {
  // Never log authorization headers, tokens, request bodies, or query strings.
  console.error('[GG Matchday API]', { event, ...error.toDiagnosticRecord() });
}

export function invalidate() {
  cache.clear();
  window.dispatchEvent(new Event('gg-data-changed'));
}

export async function authenticatedFetch(url, options = {}) {
  if (VITE_ENV.VITE_E2E_TEST_AUTH_SECRET) {
    return fetch(url, { ...options, headers: { ...(options.headers || {}), ...e2eAuthHeaders() } });
  }
  if (!auth?.currentUser) throw new Error('Authentication required.');
  const token = await auth.currentUser.getIdToken();
  return fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
}

export async function api(path, { method = 'GET', body, signal, ...options } = {}) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const key = `${auth?.currentUser?.uid || 'public'}:${path}`;
  const hit = cache.get(key);
  if (normalizedMethod === 'GET' && !signal && hit && hit.until > Date.now()) return hit.data;
  if (normalizedMethod === 'GET' && !signal && pending.has(key)) return pending.get(key);

  const task = (async () => {
    const token = await auth?.currentUser?.getIdToken();
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        method: normalizedMethod,
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...e2eAuthHeaders(),
        },
        ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      });
    } catch (cause) {
      if (cause?.name === 'AbortError') throw cause;
      const error = new ApiError('Unable to reach GG Matchday. Check your connection and try again.', {
        method: normalizedMethod,
        path,
        retryable: true,
        cause,
      });
      logApiFailure(error, 'network_failure');
      throw error;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestId = requestIdFrom(response, data);
      const serverMessage = typeof data?.message === 'string' ? data.message.trim() : '';
      const genericServerMessages = new Set(['', 'Could not complete this request.', 'The request could not be completed.']);
      let message = genericServerMessages.has(serverMessage)
        ? genericMessageForStatus(response.status)
        : serverMessage;
      if (response.status >= 500 && requestId) message += ` Reference ID: ${requestId}`;
      const error = new ApiError(message, {
        status: response.status,
        method: normalizedMethod,
        path,
        requestId,
        code: data?.code,
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      });
      if (response.status >= 500) logApiFailure(error);
      throw error;
    }

    if (normalizedMethod === 'GET') cache.set(key, { data, until: Date.now() + 15_000 });
    else invalidate();
    return data;
  })().finally(() => pending.delete(key));

  if (normalizedMethod === 'GET' && !signal) pending.set(key, task);
  return task;
}
