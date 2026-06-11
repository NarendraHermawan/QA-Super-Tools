import { neon } from '@neondatabase/serverless';
import { config } from '../config.js';

export type SqlClient = ReturnType<typeof neon>;

let sql: SqlClient | null = null;

export function isDbEnabled(): boolean {
  return Boolean(config.databaseUrl);
}

export function getDb(): SqlClient | null {
  if (!config.databaseUrl) return null;
  if (!sql) sql = neon(config.databaseUrl);
  return sql;
}
