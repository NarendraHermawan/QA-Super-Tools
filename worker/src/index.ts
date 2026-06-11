import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { getDb, isDbEnabled } from './db/client.js';
import { requireAuth } from './middleware/requireAuth.js';
import { shutdownPlaywright } from './pipeline/playwrightUploader.js';
import { purgeUploadTempRoot } from './pipeline/uploadPipeline.js';
import { autoUploadRouter } from './routes/autoUploadApi.js';

async function migrateSchema(): Promise<void> {
  if (!isDbEnabled()) {
    console.log('DATABASE_URL not set — auto_upload_log will not persist');
    return;
  }
  const db = getDb();
  if (!db) return;

  await db`
    CREATE TABLE IF NOT EXISTS auto_upload_log (
      id            SERIAL PRIMARY KEY,
      week_id       TEXT NOT NULL,
      row_id        TEXT NOT NULL,
      event_name    TEXT,
      asset_type    TEXT NOT NULL CHECK (asset_type IN ('splash', 'anno')),
      original_name TEXT,
      token_name    TEXT,
      cdn_url       TEXT,
      status        TEXT NOT NULL CHECK (status IN ('uploading', 'success', 'failed')),
      error_reason  TEXT,
      uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (week_id, row_id)
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_auto_upload_log_week_id
      ON auto_upload_log(week_id)
  `;
  console.log('auto_upload_log table ready');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auto-upload-worker' });
});

app.use('/api/auto-upload', requireAuth, autoUploadRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  },
);

await purgeUploadTempRoot();
await migrateSchema();

const server = app.listen(config.workerPort, () => {
  console.log(
    `Auto-upload worker running on http://localhost:${config.workerPort}`,
  );
});

async function shutdown(): Promise<void> {
  server.close();
  await shutdownPlaywright();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
