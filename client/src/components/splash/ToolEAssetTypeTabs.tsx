import type { ToolEAssetTab } from '../../utils/toolEFilters';

interface Props {
  active: ToolEAssetTab;
  onChange: (tab: ToolEAssetTab) => void;
  splashCount: number;
  annoCount: number;
}

const TABS: { id: ToolEAssetTab; label: string }[] = [
  { id: 'splash', label: 'Splash' },
  { id: 'anno', label: 'Anno' },
  { id: 'all', label: 'All' },
];

export function ToolEAssetTypeTabs({
  active,
  onChange,
  splashCount,
  annoCount,
}: Props) {
  const counts: Record<ToolEAssetTab, number> = {
    splash: splashCount,
    anno: annoCount,
    all: splashCount + annoCount,
  };

  return (
    <div className="chip-scroll md:flex-wrap md:overflow-visible">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`filter-chip ${
            active === tab.id ? 'filter-chip-active' : 'hover:bg-surface-sunken'
          }`}
        >
          {tab.label}
          <span className="ml-1.5 text-ink-muted">· {counts[tab.id]}</span>
        </button>
      ))}
    </div>
  );
}
