import { DateTime } from 'luxon';
import { MONTH_MAP } from './constants.js';
import type { DateRange } from '../types.js';

export const WIB = 'Asia/Jakarta';

const EXCEL_EPOCH = DateTime.fromObject(
  { year: 1899, month: 12, day: 30 },
  { zone: WIB },
);

export function normalizeDash(text: string): string {
  return text
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMonthToken(token: string): number | null {
  const key = token.toLowerCase().replace(/\./g, '');
  return MONTH_MAP[key] ?? null;
}

export function resolveYear(
  explicitYear: number | undefined,
  fallbackYear: number | undefined,
): number {
  if (explicitYear !== undefined) return explicitYear;
  if (fallbackYear !== undefined) return fallbackYear;
  return DateTime.now().setZone(WIB).year;
}

export function toIsoDate(dt: DateTime): string {
  return dt.setZone(WIB).toISODate()!;
}

export function toIsoDateTime(dt: DateTime): string {
  return dt.setZone(WIB).toISO()!;
}

export function parseDateRangeLabel(
  label: string,
  fallbackYear?: number,
): DateRange | null {
  const normalized = normalizeDash(label);

  const crossMonth = normalized.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?$/i,
  );
  if (crossMonth) {
    const startMonth = parseMonthToken(crossMonth[2]);
    const endMonth = parseMonthToken(crossMonth[4]);
    if (!startMonth || !endMonth) return null;
    const year = resolveYear(
      crossMonth[5] ? normalizeYear(Number(crossMonth[5])) : undefined,
      fallbackYear,
    );
    let endYear = year;
    if (endMonth < startMonth) endYear = year + 1;
    const start = DateTime.fromObject(
      { year, month: startMonth, day: Number(crossMonth[1]) },
      { zone: WIB },
    );
    const end = DateTime.fromObject(
      { year: endYear, month: endMonth, day: Number(crossMonth[3]) },
      { zone: WIB },
    );
    if (!start.isValid || !end.isValid) return null;
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const match = normalized.match(
    /^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?$/i,
  );
  if (!match) return null;

  const startDay = Number(match[1]);
  const endDay = Number(match[2]);
  const month = parseMonthToken(match[3]);
  if (!month) return null;

  const year = resolveYear(
    match[4] ? normalizeYear(Number(match[4])) : undefined,
    fallbackYear,
  );

  const start = DateTime.fromObject(
    { year, month, day: startDay },
    { zone: WIB },
  );
  let end = DateTime.fromObject({ year, month, day: endDay }, { zone: WIB });

  if (startDay > endDay) {
    // Month token is the end month (e.g. "27 - 2 Jun" → 27 May – 2 Jun).
    let startYear = year;
    let startMonth = month - 1;
    if (startMonth < 1) {
      startMonth = 12;
      startYear = year - 1;
    }
    const crossStart = DateTime.fromObject(
      { year: startYear, month: startMonth, day: startDay },
      { zone: WIB },
    );
    end = DateTime.fromObject({ year, month, day: endDay }, { zone: WIB });
    if (!crossStart.isValid || !end.isValid) return null;
    return { start: toIsoDate(crossStart), end: toIsoDate(end) };
  }

  if (!start.isValid || !end.isValid) return null;
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function normalizeYear(year: number): number {
  if (year < 100) return 2000 + year;
  return year;
}

export function parseTabNameRange(tabName: string): DateRange | null {
  let cleaned = normalizeDash(tabName);
  cleaned = cleaned
    .replace(/^(biweekly|weekly|ex weekly)\s+/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+(before patch|after patch|lebaran)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const yearMatch = cleaned.match(/(\d{2,4})\s*$/);
  const fallbackYear = yearMatch
    ? normalizeYear(Number(yearMatch[1]))
    : undefined;
  if (yearMatch) {
    cleaned = cleaned.replace(/\s+\d{2,4}\s*$/, '').trim();
  }

  const crossMonthDays = cleaned.match(
    /^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)$/i,
  );
  if (crossMonthDays) {
    const startMonth = parseMonthToken(crossMonthDays[3]);
    const endMonth = parseMonthToken(crossMonthDays[5]);
    if (!startMonth || !endMonth) return null;
    const year = resolveYear(undefined, fallbackYear);
    let endYear = year;
    if (endMonth < startMonth) endYear = year + 1;
    const start = DateTime.fromObject(
      { year, month: startMonth, day: Number(crossMonthDays[1]) },
      { zone: WIB },
    );
    const end = DateTime.fromObject(
      { year: endYear, month: endMonth, day: Number(crossMonthDays[4]) },
      { zone: WIB },
    );
    if (!start.isValid || !end.isValid) return null;
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const crossMonthNamed = cleaned.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)$/i,
  );
  if (crossMonthNamed) {
    return parseDateRangeLabel(crossMonthNamed[0], fallbackYear);
  }

  return parseDateRangeLabel(cleaned, fallbackYear);
}

export function parseCellDate(value: unknown): DateTime | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    const dt = EXCEL_EPOCH.plus({ days: value });
    return dt.isValid ? dt.setZone(WIB) : null;
  }

  const text = String(value).trim();
  if (!text) return null;

  const formats = [
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd",
    "dd/MM/yyyy HH:mm:ss",
    "dd/MM/yyyy",
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(text, fmt, { zone: WIB });
    if (dt.isValid) return dt;
  }

  const iso = DateTime.fromISO(text, { zone: WIB });
  if (iso.isValid) return iso;

  const numeric = Number(text);
  if (!Number.isNaN(numeric) && text.includes('.')) {
    const dt = EXCEL_EPOCH.plus({ days: numeric });
    if (dt.isValid) return dt.setZone(WIB);
  }

  return null;
}

export function eachDayInRange(range: DateRange): string[] {
  const days: string[] = [];
  let cursor = DateTime.fromISO(range.start, { zone: WIB });
  const end = DateTime.fromISO(range.end, { zone: WIB });
  while (cursor <= end) {
    days.push(toIsoDate(cursor));
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

export function dateOverlaps(
  rowStart: string,
  rowEnd: string,
  selectedDate: string,
): boolean {
  const start = DateTime.fromISO(rowStart, { zone: WIB }).startOf('day');
  const end = DateTime.fromISO(rowEnd, { zone: WIB }).endOf('day');
  const selected = DateTime.fromISO(selectedDate, { zone: WIB });
  return selected >= start && selected <= end;
}

export function sameCalendarDay(a: string, b: string): boolean {
  return (
    DateTime.fromISO(a, { zone: WIB }).toISODate() ===
    DateTime.fromISO(b, { zone: WIB }).toISODate()
  );
}

export function defaultSelectedDate(range: DateRange): string {
  const today = DateTime.now().setZone(WIB).toISODate()!;
  if (today >= range.start && today <= range.end) return today;
  return range.start;
}

export function formatWeekLabel(range: DateRange): string {
  const start = DateTime.fromISO(range.start, { zone: WIB });
  const end = DateTime.fromISO(range.end, { zone: WIB });
  const startMonth = start.toFormat('d');
  const endPart = end.toFormat('d MMM yy');
  return `${startMonth} - ${endPart}`;
}

/** Grid-style sub-week label (no year), e.g. "17 - 24 Jun". */
export function formatSubWeekLabelFromRange(range: DateRange): string {
  const start = DateTime.fromISO(range.start, { zone: WIB });
  const end = DateTime.fromISO(range.end, { zone: WIB });
  if (start.month === end.month) {
    return `${start.toFormat('d')} - ${end.toFormat('d MMM')}`;
  }
  return `${start.toFormat('d MMM')} - ${end.toFormat('d MMM')}`;
}

export function tabRangeDaySpan(range: DateRange): number {
  const start = DateTime.fromISO(range.start, { zone: WIB });
  const end = DateTime.fromISO(range.end, { zone: WIB });
  return end.diff(start, 'days').days;
}

/** One sub-week tab (≤7 days), not a biweekly container tab. */
export function isSingleWeekTabRange(range: DateRange): boolean {
  return tabRangeDaySpan(range) <= 7;
}

export function todayWib(): string {
  return DateTime.now().setZone(WIB).toISODate()!;
}

/** Parse a sub-week label using the containing tab's range to pick the correct year. */
export function parseSubWeekInTabContext(
  label: string,
  tabRange: DateRange,
): DateRange | null {
  const startYear = Number(tabRange.start.slice(0, 4));
  const endYear = Number(tabRange.end.slice(0, 4));
  const candidateYears = [...new Set([startYear, endYear])];

  for (const year of candidateYears) {
    const range = parseDateRangeLabel(label, year);
    if (!range) continue;
    if (range.start <= tabRange.end && range.end >= tabRange.start) {
      return range;
    }
  }

  return parseDateRangeLabel(label, startYear);
}

/** Keep sub-weeks that overlap a rolling window around today (not far past/future). */
export function isRelevantSubWeek(
  range: DateRange,
  todayIso: string = todayWib(),
): boolean {
  const today = DateTime.fromISO(todayIso, { zone: WIB });
  const weekStart = DateTime.fromISO(range.start, { zone: WIB });
  const weekEnd = DateTime.fromISO(range.end, { zone: WIB });
  const oldestAllowed = today.minus({ weeks: 3 }).startOf('day');
  // Allow the next sub-week sheet (~1 week ahead) but not far-future placeholders.
  const newestAllowed = today.plus({ days: 8 }).endOf('day');

  return weekEnd >= oldestAllowed && weekStart <= newestAllowed;
}
