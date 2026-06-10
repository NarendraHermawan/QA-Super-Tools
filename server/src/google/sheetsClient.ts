import fs from 'fs';
import { google } from 'googleapis';
import { config } from '../config.js';
import type { GridRow } from '../parsing/weekModel.js';

export class SheetsClient {
  private sheets;
  private spreadsheetId: string;

  constructor(spreadsheetId: string = config.sheetId) {
    this.spreadsheetId = spreadsheetId;
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
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties.title',
    });
    return (
      response.data.sheets?.map((sheet) => sheet.properties?.title ?? '') ?? []
    ).filter(Boolean);
  }

  private escapeTabName(tabName: string): string {
    return `'${tabName.replace(/'/g, "''")}'`;
  }

  private normalizeRows(values: unknown[][]): GridRow[] {
    return values.map((row) =>
      row.map((cell) => {
        if (cell === '' || cell === null || cell === undefined) return null;
        return cell as string | number | boolean;
      }),
    );
  }

  async getTabGridProperties(
    tabName: string,
  ): Promise<{ rowCount: number; columnCount: number }> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties(title,gridProperties(rowCount,columnCount))',
    });

    const sheet = response.data.sheets?.find(
      (item) => item.properties?.title === tabName,
    );
    const grid = sheet?.properties?.gridProperties;
    return {
      rowCount: grid?.rowCount ?? 0,
      columnCount: grid?.columnCount ?? 0,
    };
  }

  async getTabRange(tabName: string, a1Range: string): Promise<GridRow[]> {
    const [grid] = await this.getTabRanges(tabName, [a1Range]);
    return grid;
  }

  async getTabRanges(tabName: string, a1Ranges: string[]): Promise<GridRow[][]> {
    const response = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: a1Ranges.map(
        (range) => `${this.escapeTabName(tabName)}!${range}`,
      ),
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const valueRanges = response.data.valueRanges ?? [];
    return valueRanges.map((item) => this.normalizeRows(item.values ?? []));
  }

  async getTabValues(tabName: string): Promise<GridRow[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.escapeTabName(tabName),
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    return this.normalizeRows(response.data.values ?? []);
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
