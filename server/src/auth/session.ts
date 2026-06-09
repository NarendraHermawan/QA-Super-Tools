import crypto from 'crypto';
import { config } from '../config.js';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionPayload {
  user: string;
  exp: number;
}

export function isAuthEnabled(): boolean {
  return Boolean(config.adminPassword && config.sessionSecret);
}

export function createSessionToken(username: string): string {
  const payload: SessionPayload = {
    user: username,
    exp: Date.now() + SESSION_MAX_AGE_MS,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadPart = Buffer.from(payloadJson).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(payloadJson)
    .digest('base64url');
  return `${payloadPart}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [payloadPart, signature] = token.split('.');
  if (!payloadPart || !signature) return null;

  try {
    const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf-8');
    const expected = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(payloadJson)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload.user || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieName = 'qa_session';
export const sessionMaxAgeMs = SESSION_MAX_AGE_MS;
