import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.resolve(projectRoot, '.env') });

function resolveFromProjectRoot(filePath: string): string {
  if (!filePath) return '';
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(projectRoot, filePath);
}

export const config = {
  sheetId: process.env.SHEET_ID ?? '',
  splashSheetId: process.env.SPLASH_SHEET_ID ?? '',
  serviceAccountKeyPath: resolveFromProjectRoot(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '',
  ),
  cdnBaseUrl: process.env.CDN_BASE_URL ?? 'https://dl.dir.freefiremobile.com/common/',
  port: Number(process.env.PORT ?? 3001),
  cacheTtlMs: Number(process.env.CACHE_TTL_MS ?? 300_000),
  splashCacheTtlMs: Number(process.env.SPLASH_CACHE_TTL_MS ?? 300_000),
  splashRecentWeeks: Number(process.env.SPLASH_RECENT_WEEKS ?? 4),
  splashRecentRowWindow: Number(process.env.SPLASH_RECENT_ROW_WINDOW ?? 250),
  cdnCheckCacheTtlMs: Number(process.env.CDN_CHECK_CACHE_TTL_MS ?? 600_000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  workerUrl: process.env.WORKER_URL ?? '',
  cdnObVersion: process.env.CDN_OB_VERSION ?? '',
  cdnApiToken: process.env.CDN_API_TOKEN ?? '',
};

export function assertConfig(): void {
  if (!config.sheetId) {
    throw new Error('SHEET_ID is required in .env');
  }
  if (!config.serviceAccountKeyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is required in .env');
  }
  if (config.nodeEnv === 'production') {
    if (!config.adminPassword) {
      throw new Error('ADMIN_PASSWORD is required in production');
    }
    if (!config.sessionSecret || config.sessionSecret.length < 32) {
      throw new Error(
        'SESSION_SECRET is required in production (min 32 characters)',
      );
    }
  }
}
