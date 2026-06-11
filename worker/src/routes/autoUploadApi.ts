import { Router, type NextFunction, type Request, type Response } from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import {
  deleteLog,
  getHistoryByWeek,
} from '../db/autoUploadRepository.js';
import { runUploadPipeline } from '../pipeline/uploadPipeline.js';
import {
  detectObVersionForWeek,
  findRecordMeta,
  getWeekRecordsForObDetection,
  warmSplashCache,
} from '../services/splashData.js';

export const autoUploadRouter = Router();

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.join(config.uploadTempDir, randomUUID());
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `original${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

autoUploadRouter.get('/config', async (req, res, next) => {
  try {
    const weekId = req.query.weekId ? String(req.query.weekId) : undefined;
    await warmSplashCache();
    const obVersion = await detectObVersionForWeek(weekId);
    res.json({
      available: true,
      obVersion: obVersion ?? null,
    });
  } catch (error) {
    next(error);
  }
});

autoUploadRouter.get('/history', async (req, res, next) => {
  try {
    const weekId = String(req.query.weekId ?? '');
    if (!weekId) {
      res.status(400).json({ error: 'weekId query parameter is required' });
      return;
    }
    const records = await getHistoryByWeek(weekId);
    res.json({ records });
  } catch (error) {
    next(error);
  }
});

autoUploadRouter.delete('/history/:rowId', async (req, res, next) => {
  try {
    const weekId = String(req.query.weekId ?? '');
    const rowId = decodeURIComponent(req.params.rowId);
    if (!weekId) {
      res.status(400).json({ error: 'weekId query parameter is required' });
      return;
    }
    await deleteLog(weekId, rowId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

autoUploadRouter.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({
          status: 'failed',
          error: 'File upload failed — server error',
        });
        return;
      }
      next();
    });
  },
  async (req, res, next) => {
    const file = req.file;
    const rowId = String(req.body.rowId ?? '');
    const assetType = String(req.body.assetType ?? '') as 'splash' | 'anno';
    const weekId = String(req.body.weekId ?? '');

    if (!file || !rowId || !weekId) {
      if (file?.destination) {
        await fs.rm(file.destination, { recursive: true, force: true }).catch(
          () => undefined,
        );
      }
      res.status(400).json({
        status: 'failed',
        error: 'file, rowId, and weekId are required',
      });
      return;
    }

    if (assetType !== 'splash' && assetType !== 'anno') {
      await fs.rm(file.destination, { recursive: true, force: true }).catch(
        () => undefined,
      );
      res.status(400).json({
        status: 'failed',
        error: 'assetType must be splash or anno',
      });
      return;
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      await fs.rm(file.destination, { recursive: true, force: true }).catch(
        () => undefined,
      );
      res.status(400).json({
        status: 'failed',
        error: 'Invalid file type — only images accepted',
      });
      return;
    }

    try {
      const meta = await findRecordMeta(weekId, rowId);
      const weekRecords = await getWeekRecordsForObDetection(weekId);

      const result = await runUploadPipeline({
        tempFilePath: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
        rowId,
        assetType: meta?.assetType ?? assetType,
        weekId,
        eventName: meta?.eventName,
        weekRecords,
      });

      await fs.rm(file.destination, { recursive: true, force: true }).catch(
        () => undefined,
      );

      res.json(result);
    } catch (error) {
      await fs.rm(file.destination, { recursive: true, force: true }).catch(
        () => undefined,
      );
      next(error);
    }
  },
);
