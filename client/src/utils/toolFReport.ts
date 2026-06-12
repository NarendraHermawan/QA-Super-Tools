import type { ToolFLogEntry } from '../api/toolF';
import { normalizeDash } from './dash';

export interface ToolFReportItem {
  eventName: string;
  detail: string;
  cdnUrl: string | null;
  message: string;
}

export interface ToolFRunReport {
  tabName: string | null;
  subWeekLabel: string | null;
  summary: { uploaded: number; failed: number; skipped: number } | null;
  uploaded: ToolFReportItem[];
  failed: ToolFReportItem[];
  skipped: ToolFReportItem[];
  errors: string[];
}

const CDN_URL_RE = /https:\/\/dl\.dir\.freefiremobile\.com[^\s)]+/;

function extractCdnUrl(text: string): string | null {
  const match = text.match(CDN_URL_RE);
  return match?.[0] ?? null;
}

type ParsedKind = 'tab' | 'subweek' | 'uploaded' | 'failed' | 'skipped' | 'summary';

function parseUserMessage(message: string): {
  kind: ParsedKind;
  eventName: string;
  detail: string;
  cdnUrl: string | null;
  summary?: { uploaded: number; failed: number; skipped: number };
} | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('Checklist tab:')) {
    return {
      kind: 'tab',
      eventName: normalizeDash(trimmed.slice('Checklist tab:'.length).trim()),
      detail: '',
      cdnUrl: null,
    };
  }

  if (trimmed.startsWith('Sub-week:')) {
    return {
      kind: 'subweek',
      eventName: normalizeDash(trimmed.slice('Sub-week:'.length).trim()),
      detail: '',
      cdnUrl: null,
    };
  }

  if (trimmed.startsWith('Uploaded — ')) {
    const body = trimmed.slice('Uploaded — '.length);
    const colon = body.indexOf(':');
    const eventName = colon >= 0 ? body.slice(0, colon).trim() : body.trim();
    const detail = colon >= 0 ? body.slice(colon + 1).trim() : '';
    return {
      kind: 'uploaded',
      eventName,
      detail,
      cdnUrl: extractCdnUrl(detail),
    };
  }

  if (trimmed.startsWith('Failed — ')) {
    const body = trimmed.slice('Failed — '.length);
    const colon = body.indexOf(':');
    const eventName = colon >= 0 ? body.slice(0, colon).trim() : body.trim();
    const detail = colon >= 0 ? body.slice(colon + 1).trim() : 'Upload failed';
    return { kind: 'failed', eventName, detail, cdnUrl: null };
  }

  if (trimmed.startsWith('Skipped — ')) {
    const body = trimmed.slice('Skipped — '.length);
    const colon = body.indexOf(':');
    const eventName = colon >= 0 ? body.slice(0, colon).trim() : body.trim();
    const detail = colon >= 0 ? body.slice(colon + 1).trim() : 'Skipped';
    return { kind: 'skipped', eventName, detail, cdnUrl: null };
  }

  if (trimmed.startsWith('Run complete — ')) {
    const body = trimmed.slice('Run complete — '.length);
    const uploaded = Number(body.match(/uploaded:\s*(\d+)/)?.[1] ?? NaN);
    const failed = Number(body.match(/failed:\s*(\d+)/)?.[1] ?? NaN);
    const skipped = Number(body.match(/skipped:\s*(\d+)/)?.[1] ?? NaN);
    if (!Number.isNaN(uploaded)) {
      return {
        kind: 'summary',
        eventName: '',
        detail: body,
        cdnUrl: null,
        summary: { uploaded, failed, skipped },
      };
    }
  }

  return null;
}

function pushItem(
  report: ToolFRunReport,
  kind: ParsedKind,
  eventName: string,
  detail: string,
  cdnUrl: string | null,
  message: string,
): void {
  const item: ToolFReportItem = { eventName, detail, cdnUrl, message };
  const list =
    kind === 'uploaded'
      ? report.uploaded
      : kind === 'failed'
        ? report.failed
        : report.skipped;
  if (list.some((row) => row.message === message)) return;
  list.push(item);
}

function ingestMessage(report: ToolFRunReport, message: string): void {
  const parsed = parseUserMessage(message);
  if (!parsed) return;

  if (parsed.kind === 'tab') {
    report.tabName = parsed.eventName;
    return;
  }

  if (parsed.kind === 'subweek') {
    report.subWeekLabel = parsed.eventName;
    return;
  }

  if (parsed.kind === 'summary' && parsed.summary) {
    report.summary = parsed.summary;
    return;
  }

  if (
    parsed.kind === 'uploaded' ||
    parsed.kind === 'failed' ||
    parsed.kind === 'skipped'
  ) {
    pushItem(
      report,
      parsed.kind,
      parsed.eventName,
      parsed.detail,
      parsed.cdnUrl,
      message,
    );
  }
}

export function buildToolFRunReport(
  lines: string[],
  logEntries?: ToolFLogEntry[],
): ToolFRunReport {
  const report: ToolFRunReport = {
    tabName: null,
    subWeekLabel: null,
    summary: null,
    uploaded: [],
    failed: [],
    skipped: [],
    errors: [],
  };

  if (logEntries?.length) {
    for (const entry of logEntries) {
      if (entry.message) ingestMessage(report, entry.message);
    }
  } else {
    for (const line of lines) ingestMessage(report, line);
  }

  if (!report.summary && (report.uploaded.length || report.failed.length || report.skipped.length)) {
    report.summary = {
      uploaded: report.uploaded.length,
      failed: report.failed.length,
      skipped: report.skipped.length,
    };
  }

  return report;
}
