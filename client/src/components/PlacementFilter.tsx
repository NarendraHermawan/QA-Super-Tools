import type { CanonicalPlacement } from '../types';
import { BANNER_PLACEMENTS } from '../types';

interface Props {
  selected: CanonicalPlacement[];
  onToggle: (placement: CanonicalPlacement) => void;
  onClear: () => void;
}

export function PlacementFilter({ selected, onToggle, onClear }: Props) {
  return (
    <>
      {BANNER_PLACEMENTS.map((placement) => {
        const active =
          selected.length === 0 || selected.includes(placement);
        return (
          <button
            key={placement}
            type="button"
            onClick={() => onToggle(placement)}
            className={`filter-chip ${
              active && selected.length > 0
                ? 'filter-chip-active'
                : 'hover:bg-surface-sunken'
            }`}
          >
            {placement}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="btn-ghost text-2xs"
        >
          Clear filter
        </button>
      )}
    </>
  );
}
