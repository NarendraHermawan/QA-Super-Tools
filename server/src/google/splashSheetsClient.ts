import fs from 'fs';
import { google } from 'googleapis';
import { config } from '../config.js';
import type { GridRow } from '../parsing/weekModel.js';

const SPLASH_TAB_NAME = 'ID - Settings';

export class SplashSheetsClient {
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

  async getSettingsTabValues(): Promise<GridRow[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: config.splashSheetId,
      range: `'${SPLASH_TAB_NAME.replace(/'/g, "''")}'`,
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
}
