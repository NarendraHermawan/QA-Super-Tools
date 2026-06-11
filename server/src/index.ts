import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAuthEnabled } from './auth/session.js';
import { assertConfig, config } from './config.js';
import { ensureSchema, isDbEnabled } from './db/client.js';
import { storageBackend } from './db/checklistRepo.js';
import { requireAuth } from './middleware/requireAuth.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assertConfig();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    storage: storageBackend(),
    auth: isAuthEnabled(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api', requireAuth, apiRouter);

void ensureSchema().then(() => {
  if (isDbEnabled()) {
    console.log('Neon checklist storage ready');
  } else {
    console.log(
      'DATABASE_URL not set — checklist uses in-memory storage (resets on restart)',
    );
  }
});

if (config.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>FFID QA — dev</title></head>
<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem">
  <h1>API server only</h1>
  <p>In development the React app runs on Vite, not this port.</p>
  <p><a href="http://localhost:5173">Open the app → http://localhost:5173</a></p>
  <p>Start both with <code>npm run dev</code> from the project root.</p>
  <p>Tool E also needs <code>npm run dev:worker</code> (port 3002).</p>
</body>
</html>`);
  });
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  },
);

app.listen(config.port, () => {
  console.log(`FFID Banner QA server running on http://localhost:${config.port}`);

  if (config.splashSheetId) {
    void import('./services/splashService.js')
      .then(({ loadParsedRecords }) => loadParsedRecords())
      .then(() => console.log('Splash sheet cache warmed on startup'))
      .catch((err) =>
        console.warn('Splash sheet warm-up skipped:', err.message),
      );
  }
});
