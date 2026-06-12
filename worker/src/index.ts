import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { getDb, isDbEnabled } from './db/client.js';
import { shutdownPlaywright } from './pipeline/playwrightUploader.js';
import { purgeUploadTempRoot } from './pipeline/uploadPipeline.js';
import { autoUploadRouter } from './routes/autoUploadApi.js';
import { toolFRouter } from './routes/toolFApi.js';

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

  await db`
    CREATE TABLE IF NOT EXISTS tool_f_jobs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status        TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
      total_rows    INTEGER NOT NULL DEFAULT 0,
      succeeded     INTEGER NOT NULL DEFAULT 0,
      failed        INTEGER NOT NULL DEFAULT 0,
      skipped       INTEGER NOT NULL DEFAULT 0,
      completed_at  TIMESTAMPTZ
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS tool_f_log (
      id            SERIAL PRIMARY KEY,
      job_id        UUID NOT NULL REFERENCES tool_f_jobs(id) ON DELETE CASCADE,
      row_label     TEXT,
      ff_url        TEXT,
      status        TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'info')),
      message       TEXT,
      cdn_url       TEXT,
      logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_tool_f_log_job_id ON tool_f_log(job_id)
  `;
  console.log('tool_f_jobs / tool_f_log tables ready');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auto-upload-worker' });
});

// Auth is enforced on the main server; the worker is a localhost-only internal service.
app.use('/api/auto-upload', autoUploadRouter);
app.use('/api/tool-f', toolFRouter);

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
