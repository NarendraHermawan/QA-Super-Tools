/**
 * One-time setup: opens a visible browser so you can log in to CDN OPS manually.
 * Saves session cookies + localStorage to credentials/cdnops-auth.json.
 *
 * Run on office WiFi: npm run setup:cdnops-auth
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { isCdnOpsLoggedIn } from '../pipeline/cdnOpsAuth.js';

const CDNOPS_BASE = 'https://cdnops.jingle.cn';
const OUT_PATH = config.cdnOpsStorageState;

function probeUploadUrl(): string {
  const ob = config.cdnObVersion || 'OB53';
  return `${CDNOPS_BASE}/upload/${ob}/ID/splash`;
}

async function main(): Promise<void> {
  const outDir = path.dirname(OUT_PATH);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Opening CDN OPS in a browser window…');
  console.log('1. Log in with your CDN OPS account (Google SSO is fine)');
  console.log('2. Wait until you see the file manager with Upload / All Files');
  console.log(`3. Session will be saved to: ${OUT_PATH}`);
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(probeUploadUrl(), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    if (await isCdnOpsLoggedIn(page)) break;
    await page.waitForTimeout(1000);
  }

  if (!(await isCdnOpsLoggedIn(page))) {
    console.error('Timed out — login not detected on the upload page. Try again.');
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: OUT_PATH });
  console.log(`Saved CDN OPS session to ${OUT_PATH}`);
  console.log('Restart the worker: npm run dev:worker');
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
