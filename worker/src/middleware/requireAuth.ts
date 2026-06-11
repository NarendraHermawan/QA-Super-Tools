import type { NextFunction, Request, Response } from 'express';
import {
  isAuthEnabled,
  sessionCookieName,
  verifySessionToken,
} from '../auth/session.js';

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isAuthEnabled()) {
    next();
    return;
  }

  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.authUser = session.user;
  next();
}
