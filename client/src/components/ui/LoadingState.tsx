interface Props {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: Props) {
  return (
    <div className="page-shell">
      <div className="panel px-6 py-10 text-center text-sm text-ink-muted">
        {message}
      </div>
    </div>
  );
}
