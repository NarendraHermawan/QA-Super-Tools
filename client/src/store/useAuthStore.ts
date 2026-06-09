import { create } from 'zustand';
import { fetchAuthStatus, login as apiLogin, logout as apiLogout } from '../api/auth';

interface AuthState {
  ready: boolean;
  authEnabled: boolean;
  authenticated: boolean;
  username: string | null;
  error: string;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  authEnabled: false,
  authenticated: false,
  username: null,
  error: '',
  bootstrap: async () => {
    try {
      const status = await fetchAuthStatus();
      set({
        ready: true,
        authEnabled: status.authEnabled,
        authenticated: status.authenticated,
        username: status.username,
        error: '',
      });
    } catch {
      set({
        ready: true,
        authEnabled: true,
        authenticated: false,
        username: null,
        error: 'Could not verify session',
      });
    }
  },
  login: async (username, password) => {
    set({ error: '' });
    try {
      const result = await apiLogin(username, password);
      set({
        authenticated: true,
        authEnabled: true,
        username: result.username,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message });
      throw err;
    }
  },
  logout: async () => {
    await apiLogout();
    set({ authenticated: false, username: null });
  },
}));
