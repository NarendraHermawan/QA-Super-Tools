import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { upsertLog } from '../db/autoUploadRepository.js';
import {
  detectObVersion,
  OB_DETECTION_ERROR,
  type ObDetectionRecord,
} from './obVersionDetector.js';
import { uploadToCdnPortal } from './playwrightUploader.js';
import { buildCdnUrl, generateUploadToken } from './token.js';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface UploadPipelineInput {
  tempFilePath: string;
  originalName: string;
  mimeType: string;
  rowId: string;
  assetType: 'splash' | 'anno';
  weekId: string;
  eventName?: string | null;
  weekRecords: ObDetectionRecord[];
}

export interface UploadPipelineSuccess {
  status: 'success';
  tokenName: string;
  cdnUrl: string;
}

export interface UploadPipelineFailure {
  status: 'failed';
  error: string;
}

export type UploadPipelineResult = UploadPipelineSuccess | UploadPipelineFailure;

async function cleanupDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

export async function runUploadPipeline(
  input: UploadPipelineInput,
): Promise<UploadPipelineResult> {
  const uploadId = randomUUID();
  const workDir = path.join(config.uploadTempDir, uploadId);

  try {
    await fs.mkdir(workDir, { recursive: true });

    const extFromMime = MIME_TO_EXT[input.mimeType];
    const extFromName = path.extname(input.originalName).slice(1);
    const ext = extFromMime ?? (extFromName || 'bin');
    const token = generateUploadToken();
    const tokenName = `${token}.${ext}`;
    const renamedPath = path.join(workDir, tokenName);

    await fs.copyFile(input.tempFilePath, renamedPath);

    const obVersion = detectObVersion(input.weekRecords);
    if (!obVersion) {
      await upsertLog({
        weekId: input.weekId,
        rowId: input.rowId,
        eventName: input.eventName,
        assetType: input.assetType,
        originalName: input.originalName,
        status: 'failed',
        errorReason: OB_DETECTION_ERROR,
      });
      return { status: 'failed', error: OB_DETECTION_ERROR };
    }

    await upsertLog({
      weekId: input.weekId,
      rowId: input.rowId,
      eventName: input.eventName,
      assetType: input.assetType,
      originalName: input.originalName,
      tokenName,
      status: 'uploading',
    });

    try {
      await uploadToCdnPortal(obVersion, renamedPath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'CDN upload failed';
      await upsertLog({
        weekId: input.weekId,
        rowId: input.rowId,
        eventName: input.eventName,
        assetType: input.assetType,
        originalName: input.originalName,
        tokenName,
        status: 'failed',
        errorReason: message,
      });
      return { status: 'failed', error: message };
    }

    const cdnUrl = buildCdnUrl(obVersion, tokenName);

    await upsertLog({
      weekId: input.weekId,
      rowId: input.rowId,
      eventName: input.eventName,
      assetType: input.assetType,
      originalName: input.originalName,
      tokenName,
      cdnUrl,
      status: 'success',
    });

    return { status: 'success', tokenName, cdnUrl };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'File upload failed — server error';
    await upsertLog({
      weekId: input.weekId,
      rowId: input.rowId,
      eventName: input.eventName,
      assetType: input.assetType,
      originalName: input.originalName,
      status: 'failed',
      errorReason: message,
    }).catch(() => undefined);
    return { status: 'failed', error: message };
  } finally {
    await cleanupDir(workDir);
  }
}

export async function purgeUploadTempRoot(): Promise<void> {
  await fs.rm(config.uploadTempDir, { recursive: true, force: true }).catch(
    () => undefined,
  );
  await fs.mkdir(config.uploadTempDir, { recursive: true }).catch(() => undefined);
}
