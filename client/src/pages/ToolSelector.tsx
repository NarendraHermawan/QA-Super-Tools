import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';

export function ToolSelector() {
  return (
    <div className="page-shell space-y-8">
      <PageHeader
        title="FFID LiveOps QA"
        description="Choose a tool suite. Banner QA covers weekly sheet banners; Splash & Anno covers in-game publishing assets."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Link to="/banner" className="panel block transition-colors hover:border-line-strong">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink">Banner QA</h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Weekly master sheet — Tool A & B
            </p>
          </div>
          <div className="space-y-2 p-4 text-sm text-ink-secondary">
            <p>
              <span className="font-medium text-ink">Tool A</span> — CDN upload
              checker for weekly banners.
            </p>
            <p>
              <span className="font-medium text-ink">Tool B</span> — In-game QA
              checklist with day carry-over.
            </p>
          </div>
        </Link>

        <Link to="/splash" className="panel block transition-colors hover:border-line-strong">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink">Splash & Anno</h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              In-Game Publishing — Tool C & D
            </p>
          </div>
          <div className="space-y-2 p-4 text-sm text-ink-secondary">
            <p>
              <span className="font-medium text-ink">Tool C</span> — Upload
              checker for splash and announcement assets.
            </p>
            <p>
              <span className="font-medium text-ink">Tool D</span> — In-game QA
              checklist for splash and anno schedules.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
