import { Router } from 'express';
import { config } from '../config.js';
import {
  findRunningJob,
  getJobLogs,
  getActiveJobId,
  listJobs,
} from '../db/toolFRepository.js';
import {
  cancelToolFJob,
  isToolFRunning,
  startToolFJob,
} from '../services/toolFJobManager.js';

export const toolFRouter = Router();

toolFRouter.get('/config', async (_req, res, next) => {
  try {
    const running = await findRunningJob();
    const available = Boolean(config.cdnApiToken);
    res.json({
      available,
      activeJobId: running?.id ?? getActiveJobId(),
      pythonConfigured: Boolean(config.cdnApiToken && config.notionApiToken),
    });
  } catch (error) {
    next(error);
  }
});

export interface ToolFRunScope {
  tabName: string;
  subWeekLabel: string;
  weekLabel?: string;
}

toolFRouter.post('/run', async (req, res, next) => {
  try {
    if (isToolFRunning() || (await findRunningJob())) {
      res.status(409).json({ error: 'A Tool F job is already running' });
      return;
    }

    const body = req.body as Partial<ToolFRunScope>;
    const tabName = body.tabName?.trim();
    const subWeekLabel = body.subWeekLabel?.trim();
    if (!tabName || !subWeekLabel) {
      res.status(400).json({ error: 'tabName and subWeekLabel are required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent({ type: 'started' });

    void startToolFJob(writeEvent, { tabName, subWeekLabel })
      .then(() => {
        res.end();
      })
      .catch((error: Error) => {
        writeEvent({ type: 'error', message: error.message });
        res.end();
      });

    req.on('close', () => {
      if (isToolFRunning()) {
        void cancelToolFJob();
      }
    });
  } catch (error) {
    next(error);
  }
});

toolFRouter.post('/cancel', async (_req, res, next) => {
  try {
    const cancelled = await cancelToolFJob();
    if (!cancelled) {
      res.status(404).json({ error: 'No running Tool F job' });
      return;
    }
    res.json({ cancelled: true });
  } catch (error) {
    next(error);
  }
});

toolFRouter.get('/jobs', async (_req, res, next) => {
  try {
    const jobs = await listJobs(10);
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

toolFRouter.get('/jobs/:jobId/log', async (req, res, next) => {
  try {
    const logs = await getJobLogs(req.params.jobId);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});
