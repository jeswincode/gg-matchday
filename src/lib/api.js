import {auth} from '../firebase';

const VITE_ENV = import.meta.env || {};
export const API_URL = VITE_ENV.VITE_API_URL || 'http://localhost:5000/api';
export let communitiesEnabled = VITE_ENV.VITE_V42_COMMUNITIES === 'true';
const officialApi = 'https://gg-matchday-6u6v.onrender.com/api';

export async function resolveCommunitiesMode() {
  if (communitiesEnabled || !VITE_ENV.PROD || API_URL.replace(/\/$/, '') !== officialApi) return communitiesEnabled;
  // A sleeping or temporarily unavailable API is not a rollback signal.
  communitiesEnabled = true;
  const request = new AbortController();
  const deadline = setTimeout(() => request.abort(), 1800);
  try {
    const response = await fetch(officialApi + '/platform', { cache: 'no-store', signal: request.signal });
    if (response.status === 404 || (response.ok && (await response.json()).communities === false)) communitiesEnabled = false;
  } catch { /* Keep the public entry available while the API wakes up. */ }
  finally { clearTimeout(deadline); }
  return communitiesEnabled;
}
let activeWorkspace = null;

export function setMatchdayWorkspace(id) {
  activeWorkspace = id;
}

export function matchdayApiBase() {
  return activeWorkspace ? API_URL + '/workspaces/' + activeWorkspace : API_URL;
}

function apiUrl(path) {
  return (/^\/(?:communities|health)(?:\/|\?|$)/.test(path) ? API_URL : matchdayApiBase()) + path;
}
const cache = new Map();
const pending = new Map();
let cacheRevision = 0;

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

export function invalidateResources(prefixes) {
  cacheRevision++;
  for (const entries of [cache, pending]) {
    for (const [key, entry] of entries) {
      if (!prefixes || prefixes.some(prefix => (
        entry.path === prefix || entry.path.startsWith(prefix + '/') || entry.path.startsWith(prefix + '?')
      ))) entries.delete(key);
    }
  }
}

export function invalidate(path) {
  const family = path?.match(/^\/(clubs|notifications|chat)(\/|$)/)?.[1];
  invalidateResources(family ? ["/" + family] : undefined);
  window.dispatchEvent(new CustomEvent('gg-data-changed', { detail: { path } }));
}

export async function authenticatedFetch(url, options = {}) {
  const destination = url.startsWith(API_URL + '/') ? apiUrl(url.slice(API_URL.length)) : url;
  if (VITE_ENV.VITE_E2E_TEST_AUTH_SECRET) {
    return fetch(destination, { ...options, headers: { ...(options.headers || {}), ...e2eAuthHeaders() } });
  }
  if (!auth?.currentUser) throw new Error('Authentication required.');
  const token = await auth.currentUser.getIdToken();
  return fetch(destination, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
}

export async function api(path, { method = 'GET', body, signal, publicRead = false, headers, ...options } = {}) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const anonymous = !communitiesEnabled && publicRead && normalizedMethod === 'GET';
  const destination = apiUrl(path);
  const key = `${anonymous ? 'anonymous' : auth?.currentUser?.uid || 'public'}:${destination}`;
  const hit = cache.get(key);
  if (normalizedMethod === 'GET' && !signal && hit && hit.until > Date.now()) return hit.data;
  if (normalizedMethod === 'GET' && !signal && pending.has(key)) return pending.get(key).task;
  const revision = cacheRevision;

  const task = (async () => {
    const token = anonymous ? null : await auth?.currentUser?.getIdToken();
    let response;
    try {
      response = await fetch(destination, {
        ...options,
        method: normalizedMethod,
        signal,
        headers: {
          ...headers,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(anonymous ? {} : e2eAuthHeaders()),
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

    const data = await response.json().catch(() => null);
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

    if (anonymous && data === null) {
      throw new ApiError('Matchday data is temporarily unavailable.', {
        status: response.status, method: normalizedMethod, path, retryable: true,
      });
    }
    if (normalizedMethod === 'GET') {
      if (revision === cacheRevision) cache.set(key, { path, data: data ?? {}, until: Date.now() + 15_000 });
    } else invalidate(path);
    return data ?? {};
  })().finally(() => {
    if (pending.get(key)?.task === task) pending.delete(key);
  });

  if (normalizedMethod === 'GET' && !signal) pending.set(key, { path, task });
  return task;
}
