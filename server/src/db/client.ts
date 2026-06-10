import { neon } from '@neondatabase/serverless';
import { config } from '../config.js';

export type SqlClient = ReturnType<typeof neon>;

let sql: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;

export function isDbEnabled(): boolean {
  return Boolean(config.databaseUrl);
}

export function getDb(): SqlClient | null {
  if (!config.databaseUrl) return null;
  if (!sql) sql = neon(config.databaseUrl);
  return sql;
}

export async function ensureSchema(): Promise<void> {
  if (!isDbEnabled()) return;
  if (!schemaReady) {
    schemaReady = initSchema();
  }
  await schemaReady;
}

async function initSchema(): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db`
    CREATE TABLE IF NOT EXISTS checklist_checks (
      week_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      row_id TEXT NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (week_id, check_date, row_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS confirmed_bugs (
      week_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      row_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      placement TEXT NOT NULL,
      cdn_url TEXT,
      confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (week_id, check_date, row_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS cdn_upload_overrides (
      week_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      uploaded BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (week_id, row_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS splash_checks (
      week_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      row_id TEXT NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (week_id, check_date, row_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS splash_upload_overrides (
      week_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      uploaded BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (week_id, row_id)
    )
  `;

  await migrateSplashMonthIdToWeekId(db);
}

/** Existing deploys may still have month_id from the earlier splash schema. */
async function migrateSplashMonthIdToWeekId(db: SqlClient): Promise<void> {
  const rows = (await db`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('splash_checks', 'splash_upload_overrides')
      AND column_name IN ('month_id', 'week_id')
  `) as { table_name: string; column_name: string }[];

  const byTable = new Map<string, Set<string>>();
  for (const row of rows) {
    const cols = byTable.get(row.table_name) ?? new Set<string>();
    cols.add(row.column_name);
    byTable.set(row.table_name, cols);
  }

  const checks = byTable.get('splash_checks');
  if (checks?.has('month_id') && !checks.has('week_id')) {
    await db`ALTER TABLE splash_checks RENAME COLUMN month_id TO week_id`;
  }

  const overrides = byTable.get('splash_upload_overrides');
  if (overrides?.has('month_id') && !overrides.has('week_id')) {
    await db`ALTER TABLE splash_upload_overrides RENAME COLUMN month_id TO week_id`;
  }
}

export function resetSchemaReadyForTests(): void {
  schemaReady = null;
}
