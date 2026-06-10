import type { ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}

export function MobileFieldRow({ label, children }: Props) {
  return (
    <div className="space-y-1">
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}
