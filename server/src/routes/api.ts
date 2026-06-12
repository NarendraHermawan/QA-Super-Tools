import { Router } from 'express';
import {
  clearCdnCheckCache,
  getCdnCheckCache,
  setCdnCheckCache,
} from '../cdnCheckCache.js';
import { resolveCdnOpsUploadUrlSync } from '../parsing/cdnOpsUpload.js';
import { cdnUrlForHealthCheck } from '../parsing/cdnLink.js';
import { config } from '../config.js';
import { checklistRouter } from './checklist.js';
import { autoUploadProxyRouter } from './autoUploadProxy.js';
import { toolFConfigRouter } from './toolFConfig.js';
import { toolFProxyRouter } from './toolFProxy.js';
import { splashRouter } from './splashApi.js';
import { testCdnApiConnectivity } from '../services/cdnConnectivity.js';
import {
  fetchWeekById,
  fetchWeeks,
  findWeekForDate,
  refreshData,
} from '../services/dataService.js';

export const apiRouter = Router();

apiRouter.use('/checklist', checklistRouter);
apiRouter.use('/splash', splashRouter);
apiRouter.use('/auto-upload', autoUploadProxyRouter);
apiRouter.use('/tool-f', toolFConfigRouter);
apiRouter.use('/tool-f', toolFProxyRouter);

apiRouter.get('/test-cdn-connectivity', async (_req, res, next) => {
  try {
    const result = await testCdnApiConnectivity();
    res.json({
      ...result,
      scenario: result.reachable ? 'A' : 'B',
      hint: result.reachable
        ? 'CDN API reachable — Tool F can run on Render if Python deps are installed.'
        : 'CDN API not reachable — use local Docker/worker with office network.',
    });
  } catch (error) {
    next(error);
  }
});

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
    clearCdnCheckCache();
    const data = await refreshData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/cdnops-upload-url', async (req, res, next) => {
  try {
    const rawUrl = String(req.query.url ?? '');
    if (!rawUrl.trim()) {
      res.status(400).json({ error: 'url query parameter is required' });
      return;
    }

    const uploadUrl = resolveCdnOpsUploadUrlSync(rawUrl, config.cdnBaseUrl);
    if (!uploadUrl) {
      res.status(400).json({ error: 'Could not derive CDN Ops upload path' });
      return;
    }

    res.json({ url: uploadUrl });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/cdn-check', async (req, res, next) => {
  try {
    const rawUrl = String(req.query.url ?? '');
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      res.status(400).json({ error: 'Valid url query parameter is required' });
      return;
    }

    const url = cdnUrlForHealthCheck(rawUrl);

    const cached = getCdnCheckCache(url);
    if (cached) {
      res.json({ status: cached, url });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let status: 'ok' | 'broken' = 'broken';
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      status = response.ok ? 'ok' : 'broken';
    } catch {
      status = 'broken';
    } finally {
      clearTimeout(timeout);
    }

    setCdnCheckCache(url, status);
    res.json({ status, url });
  } catch (error) {
    next(error);
  }
});
