interface Props {
  sortId: number | null;
  duplicate?: boolean;
}

export function SortIdBadge({ sortId, duplicate = false }: Props) {
  if (sortId === null) {
    return <span className="text-2xs text-ink-faint">—</span>;
  }

  return (
    <span
      className={`inline-flex min-w-[1.75rem] items-center justify-center rounded px-1.5 py-0.5 font-mono text-2xs tabular-nums ${
        duplicate
          ? 'bg-status-errorBg text-status-error'
          : 'bg-surface-sunken text-ink-secondary'
      }`}
    >
      {sortId}
    </span>
  );
}
