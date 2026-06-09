import crypto from 'crypto';
import { Router } from 'express';
import { config } from '../config.js';
import {
  createSessionToken,
  isAuthEnabled,
  sessionCookieName,
  sessionMaxAgeMs,
  verifySessionToken,
} from '../auth/session.js';

export const authRouter = Router();

authRouter.get('/status', (req, res) => {
  if (!isAuthEnabled()) {
    res.json({ authEnabled: false, authenticated: true, username: 'admin' });
    return;
  }

  const token = req.cookies?.[sessionCookieName];
  const session = token ? verifySessionToken(token) : null;
  res.json({
    authEnabled: true,
    authenticated: Boolean(session),
    username: session?.user ?? null,
  });
});

authRouter.post('/login', (req, res) => {
  if (!isAuthEnabled()) {
    res.status(400).json({ error: 'Authentication is not configured' });
    return;
  }

  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');

  const usernameOk =
    username.length === config.adminUsername.length &&
    crypto.timingSafeEqual(
      Buffer.from(username),
      Buffer.from(config.adminUsername),
    );
  const passwordOk =
    password.length === config.adminPassword.length &&
    crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(config.adminPassword),
    );

  if (!usernameOk || !passwordOk) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = createSessionToken(username);
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: sessionMaxAgeMs,
    path: '/',
  });

  res.json({ ok: true, username });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(sessionCookieName, { path: '/' });
  res.json({ ok: true });
});
