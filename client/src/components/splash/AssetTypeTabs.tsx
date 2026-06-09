import type { SplashAssetType } from '../../types';

interface Props {
  active: SplashAssetType;
  onChange: (tab: SplashAssetType) => void;
}

export function AssetTypeTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange('splash')}
        className={`filter-chip ${active === 'splash' ? 'filter-chip-active' : 'hover:bg-surface-sunken'}`}
      >
        Splash
      </button>
      <button
        type="button"
        onClick={() => onChange('anno')}
        className={`filter-chip ${active === 'anno' ? 'filter-chip-active' : 'hover:bg-surface-sunken'}`}
      >
        Anno
      </button>
    </div>
  );
}
