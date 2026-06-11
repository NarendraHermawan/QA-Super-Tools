import { useState } from 'react';
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
): { text: string; isSuggested: boolean } {
  if (sheetValue) {
    return { text: sheetValue, isSuggested: false };
  }
  if (lookup.status === 'suggested') {
    return {
      text: field === 'gopos' ? lookup.gopos : lookup.subGopos,
      isSuggested: true,
    };
  }
  return { text: '— not found', isSuggested: false };
}

export function GoposField({ label, sheetValue, lookup, field }: Props) {
  const [copied, setCopied] = useState(false);
  const { text, isSuggested } = displayValue(sheetValue, lookup, field);
  const notFound = !sheetValue && lookup.status === 'not_found';

  const handleCopy = async () => {
    if (!text || text === '— not found') return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

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
        {isSuggested && (
          <button type="button" onClick={() => void handleCopy()} className="btn-ghost text-2xs">
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
