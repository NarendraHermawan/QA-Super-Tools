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
  workerPort: Number(process.env.WORKER_PORT ?? 3002),
  cdnObVersion: process.env.CDN_OB_VERSION ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  uploadTempDir: process.env.UPLOAD_TEMP_DIR ?? '/tmp/qa-upload',
  cdnOpsUsername: process.env.CDNOPS_USERNAME ?? '',
  cdnOpsPassword: process.env.CDNOPS_PASSWORD ?? '',
  cdnOpsStorageState: resolveFromProjectRoot(
    process.env.CDNOPS_STORAGE_STATE ??
      './credentials/cdnops-auth.json',
  ),
};
