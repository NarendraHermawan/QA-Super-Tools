import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center [&_.btn]:w-full [&_.btn]:sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
