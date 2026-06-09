import { useAppStore } from '../store/useAppStore';

export function IncludeCraftlandToggle() {
  const includeCraftland = useAppStore((s) => s.includeCraftland);
  const setIncludeCraftland = useAppStore((s) => s.setIncludeCraftland);

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
      <input
        type="checkbox"
        checked={includeCraftland}
        onChange={(e) => setIncludeCraftland(e.target.checked)}
        className="rounded border-line text-accent focus:ring-accent/30"
      />
      Include Craftland
    </label>
  );
}
