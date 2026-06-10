import type { GoposLookupResult } from '../../types';

interface Props {
  label: string;
  sheetValue: string | null;
  lookup: GoposLookupResult;
  field: 'gopos' | 'subGopos';
}

function displayValue(
  sheetValue: string | null,
  lookup: GoposLookupResult,
  field: 'gopos' | 'subGopos',
): { text: string; badge: string | null } {
  if (sheetValue) {
    return { text: sheetValue, badge: null };
  }
  if (lookup.status === 'suggested') {
    return {
      text: field === 'gopos' ? lookup.gopos : lookup.subGopos,
      badge: 'Suggested',
    };
  }
  if (lookup.status === 'conflict') {
    return {
      text: field === 'gopos' ? lookup.gopos : lookup.subGopos,
      badge: 'Conflict detected',
    };
  }
  return { text: '— not found', badge: null };
}

export function GoposField({ label, sheetValue, lookup, field }: Props) {
  const { text, badge } = displayValue(sheetValue, lookup, field);
  const notFound = !sheetValue && lookup.status === 'not_found';

  return (
    <div className="min-w-0">
      <p className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span
          className={`text-sm ${notFound ? 'italic text-ink-muted' : 'text-ink'}`}
        >
          {text}
        </span>
        {badge === 'Suggested' && (
          <span className="rounded border border-accent/20 bg-accent-muted px-1.5 py-0.5 text-2xs font-medium text-accent-hover">
            Suggested
          </span>
        )}
        {badge === 'Conflict detected' && (
          <span className="rounded border border-status-warn/20 bg-status-warnBg px-1.5 py-0.5 text-2xs font-medium text-status-warn">
            Conflict detected
          </span>
        )}
      </div>
    </div>
  );
}
