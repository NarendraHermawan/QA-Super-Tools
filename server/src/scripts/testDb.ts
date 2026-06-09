import { ensureSchema, getDb, isDbEnabled } from '../db/client.js';
import {
  getChecklistWeekState,
  setChecklistItem,
  storageBackend,
} from '../db/checklistRepo.js';

async function main() {
  console.log('DB enabled:', isDbEnabled());
  console.log('Backend:', storageBackend());

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

  const ping = await db`SELECT 1 AS ok`;
  console.log('Ping:', ping);

  const testWeek = '__connection_test__';
  const testDate = '2099-01-01';
  const testRow = 'test-row';

  await setChecklistItem(testWeek, testDate, testRow, true);
  const state = await getChecklistWeekState(testWeek);
  const saved = state.byDate[testDate]?.includes(testRow) ?? false;
  await setChecklistItem(testWeek, testDate, testRow, false);

  console.log('Write/read:', saved ? 'OK' : 'FAIL');

  if (!saved) {
    console.error('FAIL: could not read back test checklist row');
    process.exit(1);
  }

  console.log('RESULT: Neon connection works');
}

main().catch((error: Error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
