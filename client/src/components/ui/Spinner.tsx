interface Props {
  className?: string;
}

export function Spinner({ className = 'h-3 w-3' }: Props) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current/25 border-t-current ${className}`}
    />
  );
}
