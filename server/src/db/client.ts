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
}

export function resetSchemaReadyForTests(): void {
  schemaReady = null;
}
