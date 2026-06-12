export type ToolFLogKind =
  | 'tab'
  | 'uploaded'
  | 'failed'
  | 'skipped'
  | 'summary'
  | 'error';

export interface ParsedToolFLine {
  kind: ToolFLogKind;
  eventName: string;
  detail: string;
  cdnUrl: string | null;
  /** User-facing single line for the web UI */
  userMessage: string;
}

const CDN_URL_RE = /https:\/\/dl\.dir\.freefiremobile\.com[^\s|]+/;

function extractCdnUrl(text: string): string | null {
  const match = text.match(CDN_URL_RE);
  return match?.[0] ?? null;
}

export function parseToolFLine(line: string): ParsedToolFLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('TOOL_F_TAB:')) {
    const tab = trimmed.slice('TOOL_F_TAB:'.length).trim();
    return {
      kind: 'tab',
      eventName: tab,
      detail: tab,
      cdnUrl: null,
      userMessage: `Checklist tab: ${tab}`,
    };
  }

  if (trimmed.startsWith('TOOL_F_SUB_WEEK:')) {
    const label = trimmed.slice('TOOL_F_SUB_WEEK:'.length).trim();
    return {
      kind: 'tab',
      eventName: label,
      detail: label,
      cdnUrl: null,
      userMessage: `Sub-week: ${label}`,
    };
  }

  if (trimmed.startsWith('TOOL_F_UPLOADED:')) {
    const body = trimmed.slice('TOOL_F_UPLOADED:'.length).trim();
    const [eventName, ...rest] = body.split('|');
    const detail = rest.join('|').trim();
    const cdnUrl = extractCdnUrl(detail) ?? extractCdnUrl(body);
    return {
      kind: 'uploaded',
      eventName: eventName.trim(),
      detail,
      cdnUrl,
      userMessage: cdnUrl
        ? `Uploaded — ${eventName.trim()}`
        : `Uploaded — ${eventName.trim()}: ${detail}`,
    };
  }

  if (trimmed.startsWith('TOOL_F_FAILED:')) {
    const body = trimmed.slice('TOOL_F_FAILED:'.length).trim();
    const [eventName, ...rest] = body.split('|');
    const detail = rest.join('|').trim() || 'Upload failed';
    return {
      kind: 'failed',
      eventName: eventName.trim(),
      detail,
      cdnUrl: null,
      userMessage: `Failed — ${eventName.trim()}: ${detail}`,
    };
  }

  if (trimmed.startsWith('TOOL_F_SKIPPED:')) {
    const body = trimmed.slice('TOOL_F_SKIPPED:'.length).trim();
    const [eventName, ...rest] = body.split('|');
    const detail = rest.join('|').trim() || 'Skipped';
    return {
      kind: 'skipped',
      eventName: eventName.trim(),
      detail,
      cdnUrl: null,
      userMessage: `Skipped — ${eventName.trim()}: ${detail}`,
    };
  }

  if (trimmed.startsWith('TOOL_F_SUMMARY:')) {
    const body = trimmed.slice('TOOL_F_SUMMARY:'.length).trim();
    const summary = parseSummaryCounts(body);
    const userMessage = summary
      ? `Run complete — uploaded: ${summary.uploaded}, failed: ${summary.failed}, skipped: ${summary.skipped}`
      : `Run complete — ${body}`;
    return {
      kind: 'summary',
      eventName: '',
      detail: body,
      cdnUrl: null,
      userMessage,
    };
  }

  if (trimmed.startsWith('✅')) {
    const body = trimmed.slice(1).trim();
    const colon = body.indexOf(':');
    const eventName = colon >= 0 ? body.slice(0, colon).trim() : body;
    const detail = colon >= 0 ? body.slice(colon + 1).trim() : '';
    const cdnUrl = extractCdnUrl(detail);
    return {
      kind: 'uploaded',
      eventName,
      detail,
      cdnUrl,
      userMessage: cdnUrl ? `Uploaded — ${eventName}` : `Uploaded — ${body}`,
    };
  }

  if (trimmed.startsWith('❌')) {
    const body = trimmed.slice(1).trim();
    const colon = body.indexOf(':');
    const eventName = colon >= 0 ? body.slice(0, colon).trim() : body;
    const detail = colon >= 0 ? body.slice(colon + 1).trim() : 'Upload failed';
    return {
      kind: 'failed',
      eventName,
      detail,
      cdnUrl: null,
      userMessage: `Failed — ${eventName}: ${detail}`,
    };
  }

  if (/^Skipping .+: already uploaded/i.test(trimmed)) {
    const eventName = trimmed.replace(/^Skipping /, '').replace(/: already uploaded.*/i, '').trim();
    return {
      kind: 'skipped',
      eventName,
      detail: 'col L already checked',
      cdnUrl: null,
      userMessage: `Skipped — ${eventName}: col L already checked`,
    };
  }

  if (trimmed.startsWith('Using sheet:')) {
    const tab = trimmed.replace(/^Using sheet:\s*/, '').trim();
    return {
      kind: 'tab',
      eventName: tab,
      detail: tab,
      cdnUrl: null,
      userMessage: `Checklist tab: ${tab}`,
    };
  }

  return null;
}

export function isUserFacingToolFLine(line: string): boolean {
  return parseToolFLine(line) !== null;
}

export function parseSummaryCounts(detail: string): {
  uploaded: number;
  failed: number;
  skipped: number;
} | null {
  const match = detail.match(
    /uploaded=(\d+)\s+failed=(\d+)\s+skipped=(\d+)/,
  );
  if (!match) return null;
  return {
    uploaded: Number(match[1]),
    failed: Number(match[2]),
    skipped: Number(match[3]),
  };
}
