import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LoadingState } from './ui/LoadingState';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const ready = useAuthStore((s) => s.ready);
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const authenticated = useAuthStore((s) => s.authenticated);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap, location.pathname]);

  if (!ready) {
    return <LoadingState message="Checking session…" />;
  }

  if (authEnabled && !authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
