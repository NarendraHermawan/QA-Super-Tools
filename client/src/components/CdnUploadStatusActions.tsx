interface Props {
  effectiveUploaded: boolean;
  onMarkUploaded: () => void;
  onRevertUnuploaded: () => void;
}

export function CdnUploadStatusActions({
  effectiveUploaded,
  onMarkUploaded,
  onRevertUnuploaded,
}: Props) {
  if (effectiveUploaded) {
    return (
      <button
        type="button"
        onClick={onRevertUnuploaded}
        className="btn-ghost text-2xs text-ink-secondary"
      >
        Revert to unuploaded
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onMarkUploaded}
      className="btn-ghost text-2xs text-accent-hover"
    >
      Mark as uploaded
    </button>
  );
}
