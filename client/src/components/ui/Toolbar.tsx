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
    <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
      {label && (
        <span className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
