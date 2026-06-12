import { Router, type Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config.js';

const UNAVAILABLE_MESSAGE =
  'Banner auto upload requires the local worker with CDN API access (WORKER_URL).';

export const toolFProxyRouter = Router();

function sendUnavailable(res: Response): void {
  res.status(503).json({
    error: UNAVAILABLE_MESSAGE,
    available: false,
  });
}

if (config.workerUrl) {
  const proxy = createProxyMiddleware({
    target: config.workerUrl,
    changeOrigin: true,
    pathRewrite: (path) => `/api/tool-f${path}`,
    proxyTimeout: 0,
    timeout: 0,
    on: {
      error: (_err, _req, res) => {
        if (res && 'writeHead' in res) {
          sendUnavailable(res as Response);
        }
      },
    },
  });

  toolFProxyRouter.use((req, res, next) => {
    proxy(req, res, next);
  });
} else {
  toolFProxyRouter.all('*', (_req, res) => {
    sendUnavailable(res);
  });
}
