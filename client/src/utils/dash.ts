/** Match server dateUtils.normalizeDash — en/em/minus dashes → ASCII hyphen. */
export function normalizeDash(text: string): string {
  return text
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
