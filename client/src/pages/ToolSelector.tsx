import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';

export function ToolSelector() {
  return (
    <div className="page-shell space-y-8">
      <PageHeader
        title="FFID LiveOps QA"
        description="Choose a tool suite — weekly banner CDN checks or splash & anno in-game publishing."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Link to="/banner" className="panel group transition-shadow hover:shadow-md">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink group-hover:text-accent-hover">
              Banner QA
            </h2>
            <p className="mt-1 text-2xs text-ink-muted">
              Weekly CDN checklist — Tool A (upload checker) and Tool B (in-game QA).
            </p>
          </div>
          <div className="px-4 py-5">
            <p className="text-sm text-ink-secondary">
              Scope by sub-week or date from the master banner sheet.
            </p>
            <span className="btn-primary mt-4 inline-flex">Open Banner tools</span>
          </div>
        </Link>

        <Link to="/splash" className="panel group transition-shadow hover:shadow-md">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-ink group-hover:text-accent-hover">
              Splash &amp; Anno QA
            </h2>
            <p className="mt-1 text-2xs text-ink-muted">
              Monthly in-game publishing — Tool C (upload checker) and Tool D (in-game QA).
            </p>
          </div>
          <div className="px-4 py-5">
            <p className="text-sm text-ink-secondary">
              Scope by calendar month and date from ID - Settings.
            </p>
            <span className="btn-primary mt-4 inline-flex">Open Splash &amp; Anno</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
