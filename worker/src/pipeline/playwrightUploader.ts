import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';
import path from 'path';
import { createAuthenticatedContext } from './cdnOpsAuth.js';
import { CDN_PORTAL_SELECTORS } from '../playwright/selectors.js';

const CDNOPS_BASE = 'https://cdnops.jingle.cn';
const BROWSER_IDLE_MS = 5 * 60 * 1000;

let browser: Browser | null = null;
let authContext: BrowserContext | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let preflightDone = false;

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void closeBrowser();
  }, BROWSER_IDLE_MS);
}

export function invalidateAuthContext(): void {
  void authContext?.close().catch(() => undefined);
  authContext = null;
}

async function closeBrowser(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  invalidateAuthContext();
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }
  preflightDone = false;
}

async function getAuthenticatedPage(): Promise<Page> {
  const instance = await getBrowser();
  if (!authContext) {
    authContext = await createAuthenticatedContext(instance);
  }
  resetIdleTimer();
  return authContext.newPage();
}

async function probeUrl(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function runVpnPreflight(): Promise<void> {
  if (preflightDone) return;
  const reachable = await probeUrl(CDNOPS_BASE, 5000);
  if (!reachable) {
    throw new Error(
      'Cannot reach cdnops.jingle.cn — check office WiFi',
    );
  }
  preflightDone = true;
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      slowMo: 0,
    });
    preflightDone = false;
  }
  await runVpnPreflight();
  resetIdleTimer();
  return browser;
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page
    .getByText('splash', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => undefined);
}

async function findOpenUploadButton(page: Page): Promise<Locator | null> {
  const candidates: Locator[] = [
    page
      .locator(CDN_PORTAL_SELECTORS.openUploadButton)
      .filter({ hasText: CDN_PORTAL_SELECTORS.openUploadButtonText }),
    page.locator('.el-button').filter({
      hasText: CDN_PORTAL_SELECTORS.openUploadButtonText,
    }),
    page.getByRole('button', { name: 'Upload', exact: true }),
  ];

  for (const locator of candidates) {
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const btn = locator.nth(i);
      const text = (await btn.innerText().catch(() => '')).trim();
      if (text === 'Upload' && (await btn.isVisible().catch(() => false))) {
        return btn;
      }
    }
  }
  return null;
}

async function openUploadModal(page: Page): Promise<void> {
  const clickTarget = await findOpenUploadButton(page);
  if (!clickTarget) {
    throw new Error(
      'CDN portal Upload button not found — check selectors.ts',
    );
  }

  await clickTarget.click();

  const modalOpen = await Promise.race([
    page
      .getByText(CDN_PORTAL_SELECTORS.uploadModalTitle, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true),
    page
      .getByText(CDN_PORTAL_SELECTORS.dropZoneText, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true),
  ]).catch(() => false);

  if (!modalOpen) {
    throw new Error(
      'CDN portal upload modal not found — check selectors.ts',
    );
  }
}

async function pickFileInModal(page: Page, resolvedPath: string): Promise<void> {
  const fileInput = page.locator(CDN_PORTAL_SELECTORS.fileInput).first();
  let found = await fileInput
    .waitFor({ state: 'attached', timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!found) {
    const dropZone = page.getByText(CDN_PORTAL_SELECTORS.dropZoneText, {
      exact: false,
    });
    if ((await dropZone.count()) > 0) {
      await dropZone.first().click();
    }
    found = await fileInput
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  }

  if (!found) {
    throw new Error(
      'CDN portal upload input not found — check selectors.ts',
    );
  }

  await fileInput.setInputFiles(resolvedPath);
}

async function confirmUploadWithDefaults(
  page: Page,
  tokenFileName: string,
): Promise<void> {
  // Step 2: file list + Security/Suffix dropdowns — keep all defaults
  await page
    .getByText(tokenFileName, { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });

  await page
    .getByText(CDN_PORTAL_SELECTORS.confirmPanelLabel, { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => undefined);

  const confirmButtons = page
    .locator(CDN_PORTAL_SELECTORS.openUploadButton)
    .filter({ hasText: CDN_PORTAL_SELECTORS.confirmUploadButtonText });

  const count = await confirmButtons.count();
  if (count === 0) {
    throw new Error(
      'CDN portal confirm upload button not found — check selectors.ts',
    );
  }

  await confirmButtons.nth(count - 1).click();
}

async function waitForUploadSuccess(
  page: Page,
  tokenFileName: string,
): Promise<boolean> {
  return Promise.race([
    page
      .locator(CDN_PORTAL_SELECTORS.successToast)
      .first()
      .waitFor({ state: 'visible', timeout: 90000 })
      .then(() => true),
    page
      .locator('table')
      .getByText(tokenFileName, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 90000 })
      .then(() => true),
    page
      .getByText(tokenFileName, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 90000 })
      .then(() => true),
    page
      .waitForFunction(
        () => {
          const body = document.body?.innerText ?? '';
          return /upload\s*(complete|success|succeeded|finished)/i.test(body);
        },
        { timeout: 90000 },
      )
      .then(() => true),
  ]).catch(() => false);
}

export async function uploadToCdnPortal(
  obVersion: string,
  filePath: string,
): Promise<void> {
  let page: Page | null = null;
  const resolvedPath = path.resolve(filePath);
  const tokenFileName = path.basename(resolvedPath);

  try {
    page = await getAuthenticatedPage();
    const uploadUrl = `${CDNOPS_BASE}/upload/${obVersion}/ID/splash`;
    await page.goto(uploadUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await waitForPageReady(page);

    await openUploadModal(page);
    await pickFileInModal(page, resolvedPath);
    await confirmUploadWithDefaults(page, tokenFileName);

    const succeeded = await waitForUploadSuccess(page, tokenFileName);

    if (!succeeded) {
      throw new Error('Upload timed out — no success confirmation');
    }

    resetIdleTimer();
  } finally {
    if (page) await page.close().catch(() => undefined);
  }
}

export async function shutdownPlaywright(): Promise<void> {
  await closeBrowser();
}
