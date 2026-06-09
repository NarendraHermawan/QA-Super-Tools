import { DateTime } from 'luxon';
import { Router } from 'express';
import { isSplashConfigured } from '../config.js';
import {
  addSplashConfirmedBug,
  getSplashChecklistState,
  getSplashConfirmedBugs,
  setSplashChecklistBatch,
  setSplashChecklistItem,
  splashStorageBackend,
  type SplashConfirmedBug,
} from '../db/splashRepository.js';
import { WIB } from '../parsing/dateUtils.js';
import {
  recordActiveOnDate,
  type SplashRecord,
} from '../parsing/splashParser.js';
import {
  excludeStatuses,
  filterByAssetType,
  filterByDate,
  getActiveCohortSortIds,
  getDuplicateSortIds,
  getSplashRecordsForMonth,
  listSplashMonths,
  refreshSplashCache,
  splashServiceStatus,
} from '../services/splashService.js';

export const splashRouter = Router();

function splashNotConfigured(res: import('express').Response): boolean {
  if (!isSplashConfigured()) {
    res.status(503).json({
      error:
        'SPLASH_SHEET_ID is not configured. Set it in .env to use Splash & Anno tools.',
    });
    return true;
  }
  return false;
}

function daysInMonth(monthId: string): string[] {
  const [year, month] = monthId.split('-').map(Number);
  if (!year || !month) return [];
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: WIB });
  if (!start.isValid) return [];
  const days: string[] = [];
  let cursor = start;
  while (cursor.month === month) {
    days.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

function startsOnDate(record: SplashRecord, dateIso: string): boolean {
  return record.start.slice(0, 10) === dateIso;
}

function endsOnDate(record: SplashRecord, dateIso: string): boolean {
  return record.end.slice(0, 10) === dateIso;
}

function isStillActive(record: SplashRecord, dateIso: string): boolean {
  const start = record.start.slice(0, 10);
  const end = record.end.slice(0, 10);
  return dateIso > start && dateIso < end;
}

function categorizeUpload(
  records: SplashRecord[],
  showAll: boolean,
): {
  ready: SplashRecord[];
  blocked: SplashRecord[];
  needsReview: SplashRecord[];
  scheduled: SplashRecord[];
} {
  const ready: SplashRecord[] = [];
  const blocked: SplashRecord[] = [];
  const needsReview: SplashRecord[] = [];
  const scheduled: SplashRecord[] = [];

  for (const r of records) {
    if (r.status === 'DONE') continue;
    if (r.status === 'SCHEDULED') {
      if (showAll) scheduled.push(r);
      continue;
    }
    if (r.status === 'NEED TO UPDATE TRELLO') {
      blocked.push(r);
      continue;
    }
    if (r.status === 'unknown') {
      needsReview.push(r);
      continue;
    }
    if (r.status === 'TRELLO DONE') {
      if (!r.cdnUrl) ready.push(r);
      else needsReview.push(r);
    }
  }

  return { ready, blocked, needsReview, scheduled };
}

splashRouter.get('/config', (_req, res) => {
  res.json({
    ...splashServiceStatus(),
    storage: splashStorageBackend(),
  });
});

splashRouter.get('/months', async (_req, res, next) => {
  try {
    if (splashNotConfigured(res)) return;
    const months = await listSplashMonths();
    res.json({ months });
  } catch (error) {
    next(error);
  }
});

splashRouter.post('/refresh', async (_req, res, next) => {
  try {
    if (splashNotConfigured(res)) return;
    await refreshSplashCache();
    const months = await listSplashMonths();
    res.json({ ok: true, months });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/:monthId', async (req, res, next) => {
  try {
    if (splashNotConfigured(res)) return;
    const monthId = decodeURIComponent(req.params.monthId);
    const records = await getSplashRecordsForMonth(monthId);
    const days = daysInMonth(monthId);
    res.json({ monthId, records, days });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/:monthId/upload', async (req, res, next) => {
  try {
    if (splashNotConfigured(res)) return;
    const monthId = decodeURIComponent(req.params.monthId);
    const date = String(req.query.date ?? '');
    const showAll = String(req.query.showAll ?? '') === 'true';

    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const monthRecords = await getSplashRecordsForMonth(monthId);
    const dateRecords = filterByDate(monthRecords, date);
    const visible = showAll
      ? dateRecords
      : excludeStatuses(dateRecords, ['DONE', 'SCHEDULED']);

    const sections = categorizeUpload(dateRecords, showAll);

    res.json({
      monthId,
      date,
      showAll,
      records: visible,
      sections,
      duplicateSortIds: getDuplicateSortIds(monthRecords, date),
      activeCohortSortIds: getActiveCohortSortIds(monthRecords, date),
    });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/:monthId/checklist', async (req, res, next) => {
  try {
    if (splashNotConfigured(res)) return;
    const monthId = decodeURIComponent(req.params.monthId);
    const date = String(req.query.date ?? '');
    const assetType = String(req.query.assetType ?? 'splash');

    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const monthRecords = await getSplashRecordsForMonth(monthId);
    const byType = filterByAssetType(
      monthRecords,
      assetType === 'anno' ? 'anno' : 'splash',
    );
    const activeOnDate = filterByDate(byType, date);

    const appear = activeOnDate.filter((r) => startsOnDate(r, date));
    const disappear = activeOnDate.filter((r) => endsOnDate(r, date));
    const active = activeOnDate.filter((r) => isStillActive(r, date));

    res.json({
      monthId,
      date,
      assetType,
      groups: { appear, disappear, active },
      duplicateSortIds: getDuplicateSortIds(byType, date),
      activeCohortSortIds: getActiveCohortSortIds(byType, date),
    });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/:monthId/summary', async (req, res, next) => {
  try {
    if (splashNotConfigured(res)) return;
    const monthId = decodeURIComponent(req.params.monthId);
    const date = String(req.query.date ?? '');

    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const records = await getSplashRecordsForMonth(monthId);
    const activeCount = records.filter((r) => recordActiveOnDate(r, date)).length;
    const uploadSections = categorizeUpload(filterByDate(records, date), false);

    res.json({
      monthId,
      date,
      activeCount,
      readyCount: uploadSections.ready.length,
      blockedCount: uploadSections.blocked.length,
    });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/:monthId/checks', async (req, res, next) => {
  try {
    const monthId = decodeURIComponent(req.params.monthId);
    const state = await getSplashChecklistState(monthId);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

splashRouter.put('/:monthId/check', async (req, res, next) => {
  try {
    const monthId = decodeURIComponent(req.params.monthId);
    const { date, rowId, checked } = req.body as {
      date?: string;
      rowId?: string;
      checked?: boolean;
    };

    if (!date || !rowId || typeof checked !== 'boolean') {
      res.status(400).json({
        error: 'date, rowId, and checked (boolean) are required',
      });
      return;
    }

    await setSplashChecklistItem(monthId, date, rowId, checked);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

splashRouter.post('/:monthId/check-batch', async (req, res, next) => {
  try {
    const monthId = decodeURIComponent(req.params.monthId);
    const { date, rowIds } = req.body as {
      date?: string;
      rowIds?: string[];
    };

    if (!date || !Array.isArray(rowIds)) {
      res.status(400).json({ error: 'date and rowIds array are required' });
      return;
    }

    await setSplashChecklistBatch(monthId, date, rowIds);
    res.json({ ok: true, saved: rowIds.length });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/:monthId/bugs', async (req, res, next) => {
  try {
    const monthId = decodeURIComponent(req.params.monthId);
    const date = String(req.query.date ?? '');
    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const bugs = await getSplashConfirmedBugs(monthId, date);
    res.json({ bugs });
  } catch (error) {
    next(error);
  }
});

splashRouter.post('/:monthId/bugs', async (req, res, next) => {
  try {
    const monthId = decodeURIComponent(req.params.monthId);
    const bug = req.body as SplashConfirmedBug;

    if (!bug?.id || !bug?.date || !bug?.eventName || !bug?.assetType) {
      res.status(400).json({ error: 'Valid bug payload is required' });
      return;
    }

    await addSplashConfirmedBug(monthId, bug);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
