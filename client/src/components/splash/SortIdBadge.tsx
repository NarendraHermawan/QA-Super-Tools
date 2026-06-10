interface Props {
  sortId: number | null;
  duplicate?: boolean;
}

export function SortIdBadge({ sortId, duplicate }: Props) {
  if (sortId === null) {
    return (
      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-line bg-surface-sunken px-2 py-1 font-mono text-xs text-ink-muted">
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-w-[2.5rem] items-center justify-center rounded border px-2 py-1 font-mono text-sm font-semibold ${
        duplicate
          ? 'border-status-warn/40 bg-status-warnBg text-status-warn'
          : 'border-accent/30 bg-accent-muted text-accent-hover'
      }`}
      title={duplicate ? 'Duplicate Sort_ID on this date' : undefined}
    >
      #{sortId}
    </span>
  );
}
