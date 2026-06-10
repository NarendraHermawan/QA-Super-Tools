interface Props {
  displayName: string;
  assetTag: string | null;
  strikethrough?: boolean;
}

export function EventNameWithTag({
  displayName,
  assetTag,
  strikethrough = false,
}: Props) {
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={`font-medium text-ink ${
          strikethrough ? 'line-through text-ink-muted' : ''
        }`}
      >
        {displayName}
      </p>
      {assetTag && (
        <span className="inline-flex rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-secondary">
          {assetTag}
        </span>
      )}
    </div>
  );
}
