export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

const NON_URL_CDN_VALUES = new Set([
  'embed',
  'rekomendasi official',
  'kickoff campaign',
  'kreatif',
]);

export function normalizeCdnLink(
  raw: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isHttpUrl(trimmed)) return trimmed;
  if (NON_URL_CDN_VALUES.has(trimmed.toLowerCase())) return null;
  if (/\s/.test(trimmed) || !trimmed.includes('/')) return null;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${base}${path}`;
}

export function displayNameFromCdn(value: string | null): string {
  if (!value) return '(unnamed)';
  const parts = value.split('/');
  return parts[parts.length - 1] || '(unnamed)';
}
