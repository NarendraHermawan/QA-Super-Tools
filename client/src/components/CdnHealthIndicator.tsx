import { useEffect, useRef, useState } from 'react';
import { checkCdn } from '../api/client';
import {
  getClientCdnCheckCache,
  setClientCdnCheckCache,
} from '../utils/cdnCheckCache';
import { cdnUrlForHealthCheck } from '../utils/cdnLink';
import { StatusBadge } from './ui/StatusBadge';

type HealthStatus = 'checking' | 'ok' | 'broken' | 'na';

interface Props {
  url: string | null;
  onBroken?: () => void;
  /** Bump to force a fresh CDN health check (e.g. after Refresh sheet). */
  refreshToken?: number;
}

function resolveInitialStatus(url: string | null): HealthStatus {
  if (!url) return 'na';
  const cached = getClientCdnCheckCache(cdnUrlForHealthCheck(url));
  return cached ?? 'checking';
}

export function CdnHealthIndicator({ url, onBroken, refreshToken = 0 }: Props) {
  const onBrokenRef = useRef(onBroken);
  onBrokenRef.current = onBroken;

  const [status, setStatus] = useState<HealthStatus>(() => resolveInitialStatus(url));

  useEffect(() => {
    if (!url) {
      setStatus('na');
      return;
    }

    const checkUrl = cdnUrlForHealthCheck(url);
    const cached = getClientCdnCheckCache(checkUrl);
    if (cached) {
      setStatus(cached);
      if (cached === 'broken') onBrokenRef.current?.();
      return;
    }

    let cancelled = false;
    setStatus('checking');

    const markBroken = () => {
      if (cancelled) return;
      setClientCdnCheckCache(checkUrl, 'broken');
      setStatus('broken');
      onBrokenRef.current?.();
    };

    const markOk = () => {
      if (cancelled) return;
      setClientCdnCheckCache(checkUrl, 'ok');
      setStatus('ok');
    };

    const img = new Image();
    img.onload = markOk;
    img.onerror = async () => {
      if (cancelled) return;
      try {
        const result = await checkCdn(checkUrl);
        if (cancelled) return;
        if (result.status === 'ok') {
          markOk();
        } else {
          markBroken();
        }
      } catch {
        markBroken();
      }
    };
    img.src = checkUrl;

    const timeout = setTimeout(() => {
      if (cancelled) return;
      setStatus((current) => {
        if (current !== 'checking') return current;
        setClientCdnCheckCache(checkUrl, 'broken');
        onBrokenRef.current?.();
        return 'broken';
      });
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  }, [url, refreshToken]);

  if (status === 'na') {
    return <StatusBadge variant="neutral">No URL</StatusBadge>;
  }
  if (status === 'checking') {
    return (
      <StatusBadge variant="info" loading>
        Checking CDN…
      </StatusBadge>
    );
  }
  if (status === 'ok') {
    return <StatusBadge variant="ok">CDN OK</StatusBadge>;
  }
  return <StatusBadge variant="warn">CDN unreachable</StatusBadge>;
}
