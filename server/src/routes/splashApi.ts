import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config.js';
import {
  getSplashChecklistState,
  getSplashUploadOverrides,
  setSplashChecklistBatch,
  setSplashChecklistItem,
  setSplashUploadOverride,
} from '../db/splashRepository.js';
import { isSplashConfigured } from '../services/splashService.js';
import {
  fetchSplashWeekById,
  fetchSplashWeekForDate,
  fetchSplashWeeks,
  refreshSplashWeekData,
} from '../services/splashWeekService.js';

export const splashRouter = Router();

function requireSplashConfig(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isSplashConfigured()) {
    res.status(503).json({ error: 'SPLASH_SHEET_ID not configured' });
    return;
  }
  next();
}

splashRouter.use(requireSplashConfig);

splashRouter.get('/sheet-url', (_req, res) => {
  res.json({
    url: `https://docs.google.com/spreadsheets/d/${config.splashSheetId}/edit`,
  });
});

splashRouter.get('/weeks', async (_req, res, next) => {
  try {
    const data = await fetchSplashWeeks();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/week/:weekId', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const date = req.query.date ? String(req.query.date) : undefined;
    const data = await fetchSplashWeekById(weekId, date);
    if (!data) {
      res.status(404).json({ error: 'Week not found' });
      return;
    }
    res.json(data);
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/week-for-date/:date', async (req, res, next) => {
  try {
    const result = await fetchSplashWeekForDate(req.params.date);
    if (!result) {
      res.status(404).json({
        error:
          'This date is not covered by any of the 4 most recent weeks.',
      });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

splashRouter.post('/refresh', async (_req, res, next) => {
  try {
    const data = await refreshSplashWeekData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/upload-overrides/:weekId', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const overrides = await getSplashUploadOverrides(weekId);
    res.json({ overrides });
  } catch (error) {
    next(error);
  }
});

splashRouter.put('/upload-overrides/:weekId', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const rowId = String(req.body?.rowId ?? '');
    const uploaded = Boolean(req.body?.uploaded);
    if (!rowId) {
      res.status(400).json({ error: 'rowId is required' });
      return;
    }
    await setSplashUploadOverride(weekId, rowId, uploaded);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

splashRouter.get('/checklist/:weekId', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const state = await getSplashChecklistState(weekId);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

splashRouter.put('/checklist/:weekId/check', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const date = String(req.body?.date ?? '');
    const rowId = String(req.body?.rowId ?? '');
    const checked = Boolean(req.body?.checked);
    if (!date || !rowId) {
      res.status(400).json({ error: 'date and rowId are required' });
      return;
    }
    await setSplashChecklistItem(weekId, date, rowId, checked);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

splashRouter.post('/checklist/:weekId/check-batch', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const date = String(req.body?.date ?? '');
    const rowIds = Array.isArray(req.body?.rowIds)
      ? req.body.rowIds.map(String)
      : [];
    if (!date) {
      res.status(400).json({ error: 'date is required' });
      return;
    }
    await setSplashChecklistBatch(weekId, date, rowIds);
    res.json({ ok: true, saved: rowIds.length });
  } catch (error) {
    next(error);
  }
});
