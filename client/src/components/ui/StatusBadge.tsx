import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'ok' | 'warn' | 'error' | 'neutral' | 'info';

const styles: Record<Variant, string> = {
  ok: 'bg-status-okBg text-status-ok border-status-ok/20',
  warn: 'bg-status-warnBg text-status-warn border-status-warn/20',
  error: 'bg-status-errorBg text-status-error border-status-error/20',
  neutral: 'bg-status-neutralBg text-status-neutral border-line',
  info: 'bg-accent-muted text-accent-hover border-accent/20',
};

interface Props {
  variant: Variant;
  children: ReactNode;
  loading?: boolean;
}

export function StatusBadge({ variant, children, loading }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-2xs font-medium ${styles[variant]}`}
    >
      {loading ? (
        <Spinner />
      ) : (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            variant === 'ok'
              ? 'bg-status-ok'
              : variant === 'warn'
                ? 'bg-status-warn'
                : variant === 'error'
                  ? 'bg-status-error'
                  : variant === 'info'
                    ? 'bg-accent'
                    : 'bg-status-neutral'
          }`}
        />
      )}
      {children}
    </span>
  );
}
