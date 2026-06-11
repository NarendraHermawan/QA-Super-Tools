import { Router, type Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config.js';

const UNAVAILABLE_MESSAGE =
  'Auto upload is only available when running locally via Docker with office WiFi.';

export const autoUploadProxyRouter = Router();

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
    pathRewrite: (path) => `/api/auto-upload${path}`,
    on: {
      error: (_err, _req, res) => {
        if (res && 'writeHead' in res) {
          sendUnavailable(res as Response);
        }
      },
    },
  });

  autoUploadProxyRouter.use((req, res, next) => {
    proxy(req, res, next);
  });
} else {
  autoUploadProxyRouter.all('*', (_req, res) => {
    sendUnavailable(res);
  });
}
