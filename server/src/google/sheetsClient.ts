import fs from 'fs';
import { google } from 'googleapis';
import { config } from '../config.js';
import type { GridRow } from '../parsing/weekModel.js';

export class SheetsClient {
  private sheets;

  constructor() {
    const credentials = JSON.parse(
      fs.readFileSync(config.serviceAccountKeyPath, 'utf-8'),
    );
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async listTabNames(): Promise<string[]> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
      fields: 'sheets.properties.title',
    });
    return (
      response.data.sheets?.map((sheet) => sheet.properties?.title ?? '') ?? []
    ).filter(Boolean);
  }

  async getTabValues(tabName: string): Promise<GridRow[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${tabName.replace(/'/g, "''")}'`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const values = response.data.values ?? [];
    return values.map((row) =>
      row.map((cell) => {
        if (cell === '' || cell === null || cell === undefined) return null;
        return cell as string | number | boolean;
      }),
    );
  }

  async getTabsValues(tabNames: string[]): Promise<Record<string, GridRow[]>> {
    const result: Record<string, GridRow[]> = {};
    await Promise.all(
      tabNames.map(async (tabName) => {
        result[tabName] = await this.getTabValues(tabName);
      }),
    );
    return result;
  }
}
