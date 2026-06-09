import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function Toolbar({ children }: Props) {
  return (
    <div className="panel divide-y divide-line">
      {children}
    </div>
  );
}

export function ToolbarRow({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      {label && (
        <span className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </span>
      )}
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
