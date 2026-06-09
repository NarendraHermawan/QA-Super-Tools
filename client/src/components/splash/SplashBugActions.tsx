import type { SplashConfirmedBug } from '../../types';

interface Props {
  onConfirm: (bug: SplashConfirmedBug) => void;
  rowId: string;
  eventName: string;
  assetType: SplashConfirmedBug['assetType'];
  cdnUrl: string | null;
  date: string;
  isBroken: boolean;
  isConfirmed: boolean;
}

export function SplashBugActions({
  onConfirm,
  rowId,
  eventName,
  assetType,
  cdnUrl,
  date,
  isBroken,
  isConfirmed,
}: Props) {
  if (!isBroken) return null;

  return (
    <button
      type="button"
      disabled={isConfirmed}
      onClick={() =>
        onConfirm({ id: rowId, eventName, assetType, cdnUrl, date })
      }
      className="btn-ghost text-2xs text-status-warn disabled:opacity-50"
    >
      {isConfirmed ? 'Bug confirmed' : 'Confirm bug'}
    </button>
  );
}
