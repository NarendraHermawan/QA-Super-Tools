const CDN_API_BASE = 'https://cdnops.jingle.cn/api/public';

export interface CdnConnectivityResult {
  reachable: boolean;
  status?: number;
  error?: string;
  testedAt: string;
}

export async function testCdnApiConnectivity(
  bearerToken?: string,
): Promise<CdnConnectivityResult> {
  const testedAt = new Date().toISOString();
  const token = bearerToken ?? process.env.CDN_API_TOKEN ?? '';

  try {
    const form = new FormData();
    form.append('path', '/');
    form.append('name', 'test-connectivity-check');

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${CDN_API_BASE}/folder`, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });
      return {
        reachable: true,
        status: response.status,
        testedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
      testedAt,
    };
  }
}
