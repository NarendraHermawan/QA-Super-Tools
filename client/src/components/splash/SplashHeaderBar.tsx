import { useNavigate } from 'react-router-dom';
import { useSplashStore } from '../../store/useSplashStore';

export function SplashHeaderBar() {
  const navigate = useNavigate();
  const selectedWeek = useSplashStore((s) => s.selectedWeek);
  const resetSplashSession = useSplashStore((s) => s.resetSplashSession);

  if (!selectedWeek) return null;

  return (
    <div className="border-b border-line bg-surface-sunken">
      <div className="page-shell flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
            Active scope
          </p>
          <p className="truncate font-medium text-ink">{selectedWeek.label}</p>
          <p className="truncate text-2xs text-ink-muted">
            Sheet tab: {selectedWeek.tabName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetSplashSession();
            navigate('/splash');
          }}
          className="btn-secondary w-full shrink-0 sm:w-auto"
        >
          Change week
        </button>
      </div>
    </div>
  );
}
