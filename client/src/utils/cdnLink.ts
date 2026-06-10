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

/** CDN stores .ff_extend assets; health checks use the equivalent .jpg URL. */
export function cdnUrlForHealthCheck(url: string): string {
  return url.replace(/\.ff_extend/gi, '.jpg');
}
