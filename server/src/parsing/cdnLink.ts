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

export function displayNameFromCdn(value: string | null): string {
  if (!value) return '(unnamed)';
  const parts = value.split('/');
  return parts[parts.length - 1] || '(unnamed)';
}

const ASSET_TAG_ALIASES: Record<string, string> = {
  mallsmall: 'Mall small',
  titlemall: 'Title mall',
  bgmall: 'Mall background',
  lobbybg: 'Lobby BG',
  lobbybgid: 'Lobby BG',
  tabid: 'Tab',
  titleid: 'Title',
  spinbg: 'Spin BG',
  spinbgid: 'Spin BG',
  overview: 'Overview',
  overview1: 'Overview',
};

function normalizeAssetKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractAssetStem(filename: string): string {
  const withoutExt = filename.replace(/\.(ff_extend|png|jpg|jpeg|webp|gif)$/i, '');
  const parts = withoutExt.split('_');
  const last = parts[parts.length - 1] ?? withoutExt;
  if (last.toLowerCase() === 'ind' && parts.length >= 2) {
    return parts[parts.length - 2] ?? withoutExt;
  }
  return last;
}

function humanizeAssetStem(stem: string): string {
  const spaced = stem
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .trim();
  if (!spaced) return stem;
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Short label from CDN filename when rows share the same event name (merged cells). */
export function assetTagFromCdn(value: string | null | undefined): string | null {
  if (!value) return null;
  const filename = displayNameFromCdn(value);
  if (!filename || filename === '(unnamed)') return null;

  const stem = extractAssetStem(filename);
  const key = normalizeAssetKey(stem);
  if (!key) return null;

  if (ASSET_TAG_ALIASES[key]) return ASSET_TAG_ALIASES[key];

  if (/lobbybg/i.test(stem)) return 'Lobby BG';
  if (/tabid/i.test(stem)) return 'Tab';
  if (/titleid/i.test(stem)) return 'Title';
  if (/spinbg/i.test(stem)) return 'Spin BG';
  if (/overview/i.test(stem)) return 'Overview';

  return humanizeAssetStem(stem);
}
