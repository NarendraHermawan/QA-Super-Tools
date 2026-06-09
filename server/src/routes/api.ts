import { Router } from 'express';
import {
  fetchWeekById,
  fetchWeeks,
  findWeekForDate,
  refreshData,
} from '../services/dataService.js';

export const apiRouter = Router();

apiRouter.get('/weeks', async (_req, res, next) => {
  try {
    const data = await fetchWeeks();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/week/:weekId', async (req, res, next) => {
  try {
    const weekId = decodeURIComponent(req.params.weekId);
    const data = await fetchWeekById(weekId);
    if (!data) {
      res.status(404).json({ error: 'Week not found' });
      return;
    }
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/week-for-date/:date', async (req, res, next) => {
  try {
    const week = await findWeekForDate(req.params.date);
    if (!week) {
      res.status(404).json({
        error:
          'This date is not covered by any of the 4 most recent weeks.',
      });
      return;
    }
    res.json({ week });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/refresh', async (_req, res, next) => {
  try {
    const data = await refreshData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/cdn-check', async (req, res, next) => {
  try {
    const url = String(req.query.url ?? '');
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: 'Valid url query parameter is required' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const status = response.ok ? 'ok' : 'broken';
      res.json({ status, url });
    } catch {
      clearTimeout(timeout);
      res.json({ status: 'broken', url });
    }
  } catch (error) {
    next(error);
  }
});
