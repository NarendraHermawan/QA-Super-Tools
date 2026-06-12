import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { normalizeDash } from '../utils/dash';

export function HeaderBar() {
  const navigate = useNavigate();
  const selectedWeek = useAppStore((s) => s.selectedWeek);
  const resetSession = useAppStore((s) => s.resetSession);

  if (!selectedWeek) return null;

  return (
    <div className="border-b border-line bg-surface-sunken">
      <div className="page-shell flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
            Active scope
          </p>
          <p className="truncate font-medium text-ink">
            {normalizeDash(selectedWeek.label)}
          </p>
          <p className="truncate text-2xs text-ink-muted">
            Sheet tab: {normalizeDash(selectedWeek.tabName)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetSession();
            navigate('/');
          }}
          className="btn-secondary w-full shrink-0 sm:w-auto"
        >
          Change week
        </button>
      </div>
    </div>
  );
}
