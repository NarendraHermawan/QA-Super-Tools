import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertConfig, config } from './config.js';
import { ensureSchema, isDbEnabled } from './db/client.js';
import { storageBackend } from './db/checklistRepo.js';
import { apiRouter } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assertConfig();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    storage: storageBackend(),
  });
});

app.use('/api', apiRouter);

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
});
