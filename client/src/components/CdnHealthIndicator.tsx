import { useEffect, useState } from 'react';
import { checkCdn } from '../api/client';
import { StatusBadge } from './ui/StatusBadge';

type HealthStatus = 'checking' | 'ok' | 'broken' | 'na';

interface Props {
  url: string | null;
  onBroken?: () => void;
}

export function CdnHealthIndicator({ url, onBroken }: Props) {
  const [status, setStatus] = useState<HealthStatus>('na');

  useEffect(() => {
    if (!url) {
      setStatus('na');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    const img = new Image();
    img.onload = () => {
      if (!cancelled) setStatus('ok');
    };
    img.onerror = async () => {
      if (cancelled) return;
      try {
        const result = await checkCdn(url);
        if (!cancelled) {
          setStatus(result.status === 'ok' ? 'ok' : 'broken');
          if (result.status === 'broken') onBroken?.();
        }
      } catch {
        if (!cancelled) {
          setStatus('broken');
          onBroken?.();
        }
      }
    };
    img.src = url;

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus((current) => {
          if (current === 'checking') {
            onBroken?.();
            return 'broken';
          }
          return current;
        });
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  }, [url, onBroken]);

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
