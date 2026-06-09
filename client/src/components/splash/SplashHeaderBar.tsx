import { useNavigate } from 'react-router-dom';
import { useSplashStore } from '../../store/useSplashStore';

export function SplashHeaderBar() {
  const navigate = useNavigate();
  const monthId = useSplashStore((s) => s.monthId);
  const selectedDate = useSplashStore((s) => s.selectedDate);
  const resetSplashSession = useSplashStore((s) => s.resetSplashSession);

  if (!monthId || !selectedDate) return null;

  return (
    <div className="border-b border-line bg-surface-sunken">
      <div className="page-shell flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
            Active scope
          </p>
          <p className="truncate font-medium text-ink">{monthId}</p>
          <p className="truncate text-2xs text-ink-muted">
            Date: {selectedDate} (WIB)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetSplashSession();
            navigate('/splash');
          }}
          className="btn-secondary shrink-0"
        >
          Change month / date
        </button>
      </div>
    </div>
  );
}
