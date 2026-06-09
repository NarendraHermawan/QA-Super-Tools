interface Props {
  title: string;
  description?: string;
}

export function SectionDivider({ title, description }: Props) {
  return (
    <div className="border-t border-line pt-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-ink-secondary">{description}</p>
      )}
    </div>
  );
}
