import { Router } from 'express';
import {
  addConfirmedBug,
  getChecklistWeekState,
  getConfirmedBugs,
  setChecklistBatch,
  setChecklistItem,
  storageBackend,
} from '../db/checklistRepo.js';
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
    res.json({ ok: true });
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
    res.json({ ok: true, saved: rowIds.length });
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
