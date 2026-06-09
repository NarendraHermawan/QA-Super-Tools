import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const ready = useAuthStore((s) => s.ready);
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const authenticated = useAuthStore((s) => s.authenticated);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromQuery = new URLSearchParams(location.search).get('from');
  const redirectTo =
    fromQuery ||
    (location.state as { from?: string } | null)?.from ||
    '/';

  if (ready && (!authEnabled || authenticated)) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(redirectTo, { replace: true });
    } catch {
      // error stored in auth store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="panel w-full max-w-sm space-y-4 p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-ink">Admin sign in</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            FFID Banner QA internal access
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Username
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        {error && (
          <p className="text-sm text-status-error">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
