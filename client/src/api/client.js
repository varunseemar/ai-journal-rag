// All HTTP lives here. Components never call fetch directly.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'ai-journal-token';

// The JWT is kept in localStorage and sent as `Authorization: Bearer <token>`.
// Trade-off: readable by injected scripts (XSS), but it works when the frontend and API are on
// different domains, where cookies would be third-party and often blocked.
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// useAuth registers a handler here, so any 401 (expired token) logs the user out.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function authHeaders() {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function toApiError(res) {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && tokenStore.get()) onUnauthorized();
  // Show the first field error if there is one ("Password must be at least 8 characters").
  const firstDetail = data.error?.details && Object.values(data.error.details).flat()[0];
  return new ApiError(
    res.status,
    data.error?.code,
    firstDetail ?? data.error?.message ?? `Request failed (${res.status})`,
    data.error?.details,
  );
}

async function request(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

// The user's local date (YYYY-MM-DD). 'en-CA' happens to format dates exactly that way.
export const localToday = () => new Date().toLocaleDateString('en-CA');

// POST /api/chat answers with a Server-Sent Events stream. The browser's EventSource only supports
// GET, so we read the response body ourselves and split it into events (blank-line separated).
export async function streamChat(question, { onSources, onToken, onDone, onError, signal }) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ question, today: localToday() }),
    signal,
  });
  if (!res.ok) throw await toApiError(res);

  const handlers = { sources: onSources, token: onToken, done: onDone, error: onError };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // A network chunk can end mid-event, so only handle complete events and keep the rest.
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const event = parseEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (event) handlers[event.name]?.(event.data);
    }
  }
}

function parseEvent(block) {
  let name = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  return data ? { name, data: JSON.parse(data) } : null;
}
