import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  clearUploadHistory,
  fetchAutoUploadConfig,
  fetchAutoUploadHistory,
  uploadFile,
} from '../api/autoUpload';
import {
  fetchSplashSheetUrl,
  fetchSplashWeek,
  fetchSplashWeeks,
  refreshSplashWeeks,
} from '../api/splash';
import { SplashHeaderBar } from '../components/splash/SplashHeaderBar';
import { ToolEAssetTypeTabs } from '../components/splash/ToolEAssetTypeTabs';
import { UploadRow } from '../components/splash/UploadRow';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Toolbar, ToolbarRow } from '../components/ui/Toolbar';
import { useSplashStore } from '../store/useSplashStore';
import { useToolEStore } from '../store/useToolEStore';
import type { SplashRecord } from '../types';
import { clearClientCdnCheckCache } from '../utils/cdnCheckCache';
import { cdnOpsSplashFolderUrl } from '../utils/cdnOpsUpload';
import {
  applyToolEFilters,
  countToolEMetrics,
  isAlreadyUploadedOnSheet,
  type ToolEAssetTab,
} from '../utils/toolEFilters';

const UNAVAILABLE_MESSAGE =
  'Auto upload is only available when running locally via Docker with office WiFi.';

export function ToolE() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedWeek = useSplashStore((s) => s.selectedWeek);
  const setSelectedWeek = useSplashStore((s) => s.setSelectedWeek);
  const setWeekDataCache = useSplashStore((s) => s.setWeekDataCache);
  const clearWeekDataCache = useSplashStore((s) => s.clearWeekDataCache);
  const weekDataCache = useSplashStore((s) => s.weekDataCache);

  const rowStates = useToolEStore((s) => s.rowStates);
  const historyWeekId = useToolEStore((s) => s.historyWeekId);
  const setRowUploading = useToolEStore((s) => s.setRowUploading);
  const setRowResult = useToolEStore((s) => s.setRowResult);
  const resetRow = useToolEStore((s) => s.resetRow);
  const hydrateFromHistory = useToolEStore((s) => s.hydrateFromHistory);

  const [records, setRecords] = useState<SplashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assetTab, setAssetTab] = useState<ToolEAssetTab>('all');
  const [showAlreadyUploaded, setShowAlreadyUploaded] = useState(false);
  const [obVersion, setObVersion] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [serviceMessage, setServiceMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cdnHealthRefreshToken, setCdnHealthRefreshToken] = useState(0);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSplashSheetUrl()
      .then((data) => setSheetUrl(data.url))
      .catch(() => setSheetUrl(null));
  }, []);

  useEffect(() => {
    const weekIdParam = searchParams.get('weekId');
    if (!selectedWeek && weekIdParam) {
      fetchSplashWeeks()
        .then((data) => {
          const week = data.weeks.find((w) => w.id === weekIdParam);
          if (week) setSelectedWeek(week);
        })
        .catch(() => undefined);
    }
  }, [searchParams, selectedWeek, setSelectedWeek]);

  useEffect(() => {
    if (!selectedWeek) {
      navigate('/splash');
      return;
    }

    const cached =
      weekDataCache?.weekId === selectedWeek.id ? weekDataCache : null;

    const loadWeek = cached
      ? Promise.resolve({
          records: cached.records,
        })
      : fetchSplashWeek(selectedWeek.id).then((data) => {
          setWeekDataCache({
            weekId: selectedWeek.id,
            records: data.records,
            days: data.days,
          });
          return { records: data.records };
        });

    setLoading(true);
    Promise.all([
      loadWeek,
      fetchAutoUploadConfig(selectedWeek.id),
      historyWeekId === selectedWeek.id
        ? Promise.resolve(null)
        : fetchAutoUploadHistory(selectedWeek.id),
    ])
      .then(([weekData, config, history]) => {
        setRecords(weekData.records);
        setObVersion(config.obVersion);
        setServiceAvailable(config.available !== false);
        setServiceMessage(config.error ?? '');
        if (history) {
          hydrateFromHistory(selectedWeek.id, history);
        }
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [
    selectedWeek,
    weekDataCache,
    setWeekDataCache,
    navigate,
    historyWeekId,
    hydrateFromHistory,
  ]);

  const metrics = useMemo(() => countToolEMetrics(records), [records]);

  const filtered = useMemo(
    () =>
      applyToolEFilters(records, {
        assetTab,
        showAlreadyUploaded,
      }),
    [records, assetTab, showAlreadyUploaded],
  );

  const handleRefresh = async () => {
    if (!selectedWeek) return;
    setRefreshing(true);
    try {
      clearClientCdnCheckCache();
      clearWeekDataCache();
      await refreshSplashWeeks();
      const data = await fetchSplashWeek(selectedWeek.id);
      setWeekDataCache({
        weekId: selectedWeek.id,
        records: data.records,
        days: data.days,
      });
      setRecords(data.records);
      setCdnHealthRefreshToken((t) => t + 1);
      const config = await fetchAutoUploadConfig(selectedWeek.id);
      setObVersion(config.obVersion);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpload = useCallback(
    async (record: SplashRecord, file: File) => {
      if (!selectedWeek || !serviceAvailable) return;

      setRowUploading(record.id, file.name);
      const result = await uploadFile(file, {
        rowId: record.id,
        assetType: record.assetType,
        weekId: selectedWeek.id,
      });

      if (result.status === 'success' && result.cdnUrl && result.tokenName) {
        setRowResult(record.id, {
          state: 'success',
          tokenName: result.tokenName,
          cdnUrl: result.cdnUrl,
        });
        setCdnHealthRefreshToken((t) => t + 1);
      } else {
        setRowResult(record.id, {
          state: 'failed',
          error: result.error ?? 'Upload failed',
        });
      }
    },
    [selectedWeek, serviceAvailable, setRowUploading, setRowResult],
  );

  const handleRetry = useCallback(
    async (record: SplashRecord) => {
      if (!selectedWeek) return;
      resetRow(record.id);
      try {
        await clearUploadHistory(selectedWeek.id, record.id);
      } catch {
        // Local reset still allows re-drop
      }
    },
    [selectedWeek, resetRow],
  );

  const openCdnFolder = () => {
    const ob = obVersion ?? 'OB53';
    window.open(cdnOpsSplashFolderUrl(ob), '_blank', 'noopener,noreferrer');
  };

  if (loading) return <LoadingState message="Loading auto upload…" />;

  if (error) {
    return (
      <div className="page-shell">
        <div className="panel border-status-error/30 bg-status-errorBg px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      </div>
    );
  }

  const uploadTargetLabel = obVersion
    ? `Upload target: ${obVersion}/ID/splash`
    : 'Upload target: Not detected — set CDN_OB_VERSION in .env';

  return (
    <div>
      <SplashHeaderBar />
      <div className="page-shell space-y-5">
        <PageHeader
          title="Auto Upload"
          description="Drop splash or anno assets to rename, upload to CDN Ops, and copy the generated CDN path."
          actions={
            <>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="btn-secondary"
              >
                {refreshing ? 'Refreshing…' : 'Refresh sheet'}
              </button>
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-center"
                >
                  Open sheet
                </a>
              )}
              <button
                type="button"
                onClick={openCdnFolder}
                className="btn-secondary"
              >
                Open CDN folder
              </button>
            </>
          }
        />

        {!serviceAvailable && (
          <div className="panel border-status-warn/30 bg-status-warnBg px-4 py-3 text-sm text-status-warn">
            {serviceMessage || UNAVAILABLE_MESSAGE}
          </div>
        )}

        <div className="panel px-4 py-3">
          <p className="text-sm text-ink-secondary">{uploadTargetLabel}</p>
          <p className="mt-1 text-2xs text-ink-muted">
            Showing {metrics.total} rows with Notion URL (col Z filled)
            {metrics.total > 0 &&
              ` · ${metrics.splash} Splash · ${metrics.anno} Anno`}
          </p>
        </div>

        <Toolbar>
          <ToolbarRow label="Asset type">
            <ToolEAssetTypeTabs
              active={assetTab}
              onChange={setAssetTab}
              splashCount={metrics.splash}
              annoCount={metrics.anno}
            />
          </ToolbarRow>
          <ToolbarRow>
            <label className="flex items-center gap-2 text-2xs text-ink-secondary">
              <input
                type="checkbox"
                checked={showAlreadyUploaded}
                onChange={(e) => setShowAlreadyUploaded(e.target.checked)}
              />
              Show already uploaded
            </label>
          </ToolbarRow>
        </Toolbar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Eligible rows" value={metrics.total} />
          <StatCard label="Splash" value={metrics.splash} />
          <StatCard label="Anno" value={metrics.anno} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No eligible rows"
            description="No events with a Notion URL in col Z for the current filters."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((record) => (
              <UploadRow
                key={record.id}
                record={record}
                uploadState={rowStates[record.id] ?? { state: 'idle' }}
                disabled={!serviceAvailable}
                greyedOut={isAlreadyUploadedOnSheet(record)}
                cdnHealthRefreshToken={cdnHealthRefreshToken}
                onFileSelected={(file) => void handleUpload(record, file)}
                onRetry={() => void handleRetry(record)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
