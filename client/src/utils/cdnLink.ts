/** CDN stores .ff_extend assets; health checks use the equivalent .jpg URL. */
export function cdnUrlForHealthCheck(url: string): string {
  return url.replace(/\.ff_extend/gi, '.jpg');
}
