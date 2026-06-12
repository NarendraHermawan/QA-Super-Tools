import { Router } from 'express';
import { config } from '../config.js';

const WORKER_UNAVAILABLE =
  'Banner auto upload requires the local worker with CDN API access (WORKER_URL).';

export const toolFConfigRouter = Router();

toolFConfigRouter.get('/config', async (_req, res, next) => {
  try {
    if (!config.workerUrl) {
      res.status(503).json({
        error: WORKER_UNAVAILABLE,
        available: false,
      });
      return;
    }

    const workerUrl = config.workerUrl.replace(/\/$/, '');
    const workerRes = await fetch(`${workerUrl}/api/tool-f/config`);

    const workerBody = (await workerRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!workerRes.ok) {
      // Never surface worker auth failures as 401 — the browser session is already valid here.
      if (workerRes.status === 401 || workerRes.status === 403) {
        res.status(503).json({
          error: WORKER_UNAVAILABLE,
          available: false,
        });
        return;
      }
      res.status(workerRes.status).json(workerBody);
      return;
    }

    res.json({
      ...workerBody,
      sheetTitle: process.env.SHEET_TITLE ?? '[FFID] Weekly CDN Checklist',
    });
  } catch (error) {
    next(error);
  }
});
