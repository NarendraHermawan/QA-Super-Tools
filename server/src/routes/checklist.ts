import { Router } from 'express';
import {
  addConfirmedBug,
  clearChecklistRowFromDates,
  getChecklistWeekState,
  getConfirmedBugs,
  setChecklistBatch,
  setChecklistItem,
  storageBackend,
} from '../db/checklistRepo.js';
import {
  getUploadOverrides,
  setUploadOverride,
} from '../db/uploadOverrideRepo.js';
import {
  syncBannerQaBatchToSheet,
  syncBannerQaToSheet,
} from '../services/bannerSheetWriteback.js';
import type { ConfirmedBug } from '../types.js';

export const checklistRouter = Router();

checklistRouter.get('/storage', (_req, res) => {
  res.json({ backend: storageBackend() });
});

checklistRouter.get('/:weekId', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const state = await getChecklistWeekState(weekId);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

checklistRouter.put('/:weekId/check', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
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

    await setChecklistItem(weekId, date, rowId, checked);

    let sheetQa: Awaited<ReturnType<typeof syncBannerQaToSheet>> | undefined;
    try {
      sheetQa = await syncBannerQaToSheet(weekId, rowId, checked);
    } catch (error) {
      console.error('Tool B sheet QA write-back failed:', error);
      sheetQa = { written: false, reason: 'row_not_found' };
    }

    res.json({ ok: true, sheetQa });
  } catch (error) {
    next(error);
  }
});

checklistRouter.post('/:weekId/check-batch', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const { date, rowIds } = req.body as {
      date?: string;
      rowIds?: string[];
    };

    if (!date || !Array.isArray(rowIds)) {
      res.status(400).json({ error: 'date and rowIds array are required' });
      return;
    }

    await setChecklistBatch(weekId, date, rowIds);

    let sheetQa: { written: number; skipped: number } | undefined;
    try {
      sheetQa = await syncBannerQaBatchToSheet(weekId, rowIds, true);
    } catch (error) {
      console.error('Tool B batch sheet QA write-back failed:', error);
      sheetQa = { written: 0, skipped: rowIds.length };
    }

    res.json({ ok: true, saved: rowIds.length, sheetQa });
  } catch (error) {
    next(error);
  }
});

checklistRouter.post('/:weekId/clear-row', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const { rowId, dates } = req.body as {
      rowId?: string;
      dates?: string[];
    };

    if (!rowId || !Array.isArray(dates)) {
      res.status(400).json({ error: 'rowId and dates array are required' });
      return;
    }

    await clearChecklistRowFromDates(weekId, rowId, dates);

    let sheetQa: Awaited<ReturnType<typeof syncBannerQaToSheet>> | undefined;
    try {
      sheetQa = await syncBannerQaToSheet(weekId, rowId, false);
    } catch (error) {
      console.error('Tool B sheet QA write-back failed:', error);
      sheetQa = { written: false, reason: 'row_not_found' };
    }

    res.json({ ok: true, cleared: dates.length, sheetQa });
  } catch (error) {
    next(error);
  }
});

checklistRouter.get('/:weekId/bugs', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const date = String(req.query.date ?? '');
    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const bugs = await getConfirmedBugs(weekId, date);
    res.json({ bugs });
  } catch (error) {
    next(error);
  }
});

checklistRouter.get('/:weekId/upload-overrides', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const overrides = await getUploadOverrides(weekId);
    res.json({ overrides });
  } catch (error) {
    next(error);
  }
});

checklistRouter.put('/:weekId/upload-overrides', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const { rowId, uploaded } = req.body as {
      rowId?: string;
      uploaded?: boolean;
    };

    if (!rowId || typeof uploaded !== 'boolean') {
      res.status(400).json({
        error: 'rowId and uploaded (boolean) are required',
      });
      return;
    }

    await setUploadOverride(weekId, rowId, uploaded);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checklistRouter.post('/:weekId/bugs', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const bug = req.body as ConfirmedBug;

    if (!bug?.id || !bug?.date || !bug?.eventName || !bug?.placement) {
      res.status(400).json({ error: 'Valid bug payload is required' });
      return;
    }

    await addConfirmedBug(weekId, bug);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
