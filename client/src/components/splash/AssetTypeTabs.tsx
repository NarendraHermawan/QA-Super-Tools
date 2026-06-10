import type { SplashAssetType } from '../../types';

interface Props {
  active: SplashAssetType;
  onChange: (tab: SplashAssetType) => void;
  splashCount?: { checked: number; total: number };
  annoCount?: { checked: number; total: number };
}

export function AssetTypeTabs({
  active,
  onChange,
  splashCount,
  annoCount,
}: Props) {
  const tabs: { id: SplashAssetType; label: string; count?: string }[] = [
    {
      id: 'splash',
      label: 'Splash',
      count:
        splashCount !== undefined
          ? `${splashCount.checked} / ${splashCount.total}`
          : undefined,
    },
    {
      id: 'anno',
      label: 'Anno',
      count:
        annoCount !== undefined
          ? `${annoCount.checked} / ${annoCount.total}`
          : undefined,
    },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`filter-chip flex-1 justify-center sm:flex-none ${
            active === tab.id ? 'filter-chip-active' : 'hover:bg-surface-sunken'
          }`}
        >
          {tab.label}
          {tab.count ? (
            <span className="ml-1.5 text-ink-muted">· {tab.count} checked</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
