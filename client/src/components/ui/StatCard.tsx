interface Props {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ label, value, hint }: Props) {
  return (
    <div className="panel px-4 py-3">
      <p className="stat-label">{label}</p>
      <p className="stat-value mt-1">{value}</p>
      {hint && <p className="mt-1 text-2xs text-ink-muted">{hint}</p>}
    </div>
  );
}
