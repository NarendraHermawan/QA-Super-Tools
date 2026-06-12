import type { SubWeek } from '../types';

/** Col B section label from the sheet (matches row.subWeekLabel in the parser). */
export function subWeekGridLabel(week: SubWeek): string {
  const marker = '::';
  const idx = week.id.indexOf(marker);
  if (idx >= 0) return week.id.slice(idx + marker.length);
  return week.label;
}
