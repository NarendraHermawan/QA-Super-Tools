export interface AuthStatus {
  authEnabled: boolean;
  authenticated: boolean;
  username: string | null;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await fetch('/api/auth/status', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to check authentication status');
  }
  return response.json() as Promise<AuthStatus>;
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; username: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Login failed');
  }
  return payload as { ok: boolean; username: string };
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
