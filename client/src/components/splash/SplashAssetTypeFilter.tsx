import type { SplashAssetType } from '../../types';

export const SPLASH_ASSET_TYPE_OPTIONS: {
  id: SplashAssetType;
  label: string;
}[] = [
  { id: 'splash', label: 'Splash' },
  { id: 'anno', label: 'Announcement' },
];

interface Props {
  selected: SplashAssetType[];
  onToggle: (assetType: SplashAssetType) => void;
  onClear: () => void;
}

export function SplashAssetTypeFilter({
  selected,
  onToggle,
  onClear,
}: Props) {
  return (
    <>
      {SPLASH_ASSET_TYPE_OPTIONS.map(({ id, label }) => {
        const active = selected.length === 0 || selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={`filter-chip ${
              active && selected.length > 0
                ? 'filter-chip-active'
                : 'hover:bg-surface-sunken'
            }`}
          >
            {label}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button type="button" onClick={onClear} className="btn-ghost text-2xs">
          Clear filter
        </button>
      )}
    </>
  );
}
