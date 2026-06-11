import { getDb, isDbEnabled } from '../db/client.js';

async function migrate(): Promise<void> {
  if (!isDbEnabled()) {
    console.log('DATABASE_URL not set — skipping auto_upload_log migration');
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

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
