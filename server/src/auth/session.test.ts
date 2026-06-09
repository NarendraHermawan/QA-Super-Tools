import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    sessionSecret: 'test-secret-key-at-least-32-chars-long',
    adminPassword: 'secret',
  },
}));

import {
  createSessionToken,
  isAuthEnabled,
  verifySessionToken,
} from './session.js';

describe('session', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and verifies a session token', () => {
    const token = createSessionToken('admin');
    const session = verifySessionToken(token);
    expect(session?.user).toBe('admin');
  });

  it('rejects tampered tokens', () => {
    const token = createSessionToken('admin');
    const tampered = `${token.slice(0, -1)}x`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('rejects expired tokens', () => {
    vi.useFakeTimers();
    const token = createSessionToken('admin');
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it('reports auth enabled when password and secret exist', () => {
    expect(isAuthEnabled()).toBe(true);
  });
});
