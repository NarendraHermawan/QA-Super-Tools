import { randomBytes } from 'crypto';

export function generateUploadToken(): string {
  return randomBytes(8).toString('base64url').slice(0, 10);
}

export function buildCdnUrl(
  obVersion: string,
  tokenName: string,
): string {
  return `https://dl.dir.freefiremobile.com/common/${obVersion}/ID/splash/${tokenName}`;
}
