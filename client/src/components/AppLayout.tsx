import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const NAV = [
  { path: '/banner', label: 'Banner', match: ['/banner', '/tool-a', '/tool-b'] },
  { path: '/splash', label: 'Splash', match: ['/splash', '/tool-c', '/tool-d', '/tool-e'] },
] as const;

function isActive(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  const signOut = authEnabled ? (
    <button
      type="button"
      onClick={() => logout().then(() => window.location.assign('/login'))}
      className="btn-secondary shrink-0 text-2xs"
    >
      Sign out
    </button>
  ) : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-raised">
        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Mobile: brand + sign out, then full-width nav */}
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <Link
              to="/"
              className="min-w-0 truncate text-sm font-semibold tracking-tight text-ink"
            >
              LiveOps QA
            </Link>
            {signOut}
          </div>
          <nav className="mt-2 flex gap-1 sm:hidden">
            {NAV.map((item) => {
              const active = isActive(pathname, item.match);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex-1 rounded-md px-2 py-2 text-center text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent-muted text-accent-hover'
                      : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop: single row */}
          <div className="hidden items-center justify-between gap-4 sm:flex">
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="text-sm font-semibold tracking-tight text-ink"
              >
                FFID LiveOps QA
              </Link>
              <nav className="flex items-center gap-1">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.match);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-accent-muted text-accent-hover'
                          : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {authEnabled && username && (
                <p className="text-2xs text-ink-muted">
                  Signed in as {username}
                </p>
              )}
              {signOut}
            </div>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
