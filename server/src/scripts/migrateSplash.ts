import { getDb } from '../db/client.js';

export async function migrateSplashTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db`
    CREATE TABLE IF NOT EXISTS splash_checks (
      month_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      row_id TEXT NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (month_id, check_date, row_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS splash_bugs (
      month_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      row_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      cdn_url TEXT,
      confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (month_id, check_date, row_id)
    )
  `;
}

