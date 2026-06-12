import { SheetsClient } from '../google/sheetsClient.js';
import { findBannerRowById } from './dataService.js';

let sheetsClient: SheetsClient | null = null;

function getSheetsClient(): SheetsClient {
  if (!sheetsClient) sheetsClient = new SheetsClient();
  return sheetsClient;
}

export function resetBannerSheetWritebackClient(): void {
  sheetsClient = null;
}

export interface SheetQaWritebackResult {
  written: boolean;
  reason?: 'row_not_found' | 'no_qa_column';
}

export async function syncBannerQaToSheet(
  weekId: string,
  rowId: string,
  checked: boolean,
): Promise<SheetQaWritebackResult> {
  const found = await findBannerRowById(weekId, rowId);
  if (!found) {
    return { written: false, reason: 'row_not_found' };
  }

  const { row, tabName } = found;
  if (row.qaColumnIndex === undefined) {
    return { written: false, reason: 'no_qa_column' };
  }

  await getSheetsClient().updateCheckboxCell(
    tabName,
    row.sheetRowNumber,
    row.qaColumnIndex,
    checked,
  );

  return { written: true };
}

export async function syncBannerQaBatchToSheet(
  weekId: string,
  rowIds: string[],
  checked: boolean,
): Promise<{ written: number; skipped: number }> {
  const updates: Array<{
    tabName: string;
    row: number;
    columnIndex: number;
    checked: boolean;
  }> = [];
  let skipped = 0;

  for (const rowId of rowIds) {
    const found = await findBannerRowById(weekId, rowId);
    if (!found || found.row.qaColumnIndex === undefined) {
      skipped += 1;
      continue;
    }

    updates.push({
      tabName: found.tabName,
      row: found.row.sheetRowNumber,
      columnIndex: found.row.qaColumnIndex,
      checked,
    });
  }

  if (updates.length > 0) {
    await getSheetsClient().batchUpdateCheckboxCells(updates);
  }

  return { written: updates.length, skipped };
}
