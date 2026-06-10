import { ensureSchema, getDb, isDbEnabled } from '../db/client.js';

async function main() {
  console.log('DB enabled:', isDbEnabled());

  if (!isDbEnabled()) {
    console.error('FAIL: DATABASE_URL is not set');
    process.exit(1);
  }

  await ensureSchema();
  const db = getDb();
  if (!db) {
    console.error('FAIL: could not create DB client');
    process.exit(1);
  }

  const tables = (await db`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('splash_checks', 'splash_upload_overrides')
    ORDER BY table_name
  `) as { table_name: string }[];

  console.log(
    'Splash tables (week_id scope):',
    tables.map((row) => row.table_name).join(', '),
  );
  const columns = (await db`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('splash_checks', 'splash_upload_overrides')
    ORDER BY table_name, column_name
  `) as { table_name: string; column_name: string }[];
  console.log('Columns:', columns.map((c) => `${c.table_name}.${c.column_name}`).join(', '));
  console.log('RESULT: splash schema migration complete');
}

main().catch((error: Error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
