import { useAuthStore } from '../store/useAuthStore';

export function redirectToLogin(): void {
  useAuthStore.setState({
    authEnabled: true,
    authenticated: false,
    username: null,
  });

  if (window.location.pathname !== '/login') {
    window.location.assign(
      `/login?from=${encodeURIComponent(window.location.pathname)}`,
    );
  }
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
  });

  if (
    response.status === 401 &&
    !path.startsWith('/api/auth/') &&
    window.location.pathname !== '/login'
  ) {
    redirectToLogin();
    throw new Error('Authentication required');
  }

  return response;
}

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
