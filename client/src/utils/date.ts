export function formatDayTab(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00+07:00`);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  });
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00+07:00`);
  const e = new Date(`${end}T00:00:00+07:00`);
  const startPart = s.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  });
  const endPart = e.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  return `${startPart} - ${endPart}`;
}

/** Sentinel value for selectedDate when viewing the full week. */
export const WEEK_VIEW_ALL = '__week_all__';

export function isWeekViewAll(date: string | null | undefined): boolean {
  return date === WEEK_VIEW_ALL;
}

export function todayWib(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export function defaultDateForWeek(start: string, end: string): string {
  const today = todayWib();
  if (today >= start && today <= end) return today;
  return start;
}

export function sameCalendarDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function overlapsDate(
  rowStart: string,
  rowEnd: string,
  selectedDate: string,
): boolean {
  if (!rowStart || !rowEnd) return false;
  const start = rowStart.slice(0, 10);
  const end = rowEnd.slice(0, 10);
  return selectedDate >= start && selectedDate <= end;
}

export function startsOnDate(rowStart: string, selectedDate: string): boolean {
  return sameCalendarDay(rowStart, selectedDate);
}

export function endsOnDate(rowEnd: string, selectedDate: string): boolean {
  return sameCalendarDay(rowEnd, selectedDate);
}

export function isActiveOnDate(
  rowStart: string,
  rowEnd: string,
  selectedDate: string,
): boolean {
  const start = rowStart.slice(0, 10);
  const end = rowEnd.slice(0, 10);
  return selectedDate > start && selectedDate < end;
}
