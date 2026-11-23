const AUTH_TOKEN_KEY = 'logitrack_auth_token';

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorizedCallback = cb;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, {
    ...init,
    headers,
  });

  if (res.status === 401 && typeof input === 'string' && !input.includes('/api/auth/login')) {
    setAuthToken(null);
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  }

  return res;
}
