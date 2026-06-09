import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const NAV = [
  { path: '/', label: 'Home' },
  { path: '/tool-a', label: 'CDN Checker' },
  { path: '/tool-b', label: 'QA Checklist' },
] as const;

export function AppLayout() {
  const { pathname } = useLocation();
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-raised">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold tracking-tight text-ink">
              FFID Banner QA
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => {
                const active =
                  item.path === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.path);
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
              <p className="hidden text-2xs text-ink-muted md:block">
                Signed in as {username}
              </p>
            )}
            {authEnabled && (
              <button
                type="button"
                onClick={() => logout().then(() => window.location.assign('/login'))}
                className="btn-secondary text-2xs"
              >
                Sign out
              </button>
            )}
            <p className="hidden text-2xs text-ink-muted lg:block">
              LiveOps weekly banner operations
            </p>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
