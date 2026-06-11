import fs from 'fs';
import type { Browser, BrowserContext, Page } from 'playwright';
import { config } from '../config.js';
import { CDN_PORTAL_SELECTORS } from '../playwright/selectors.js';

const CDNOPS_BASE = 'https://cdnops.jingle.cn';

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const CDN_OPS_AUTH_HELP =
  'CDN OPS login required. Run: npm run setup:cdnops-auth (while on office WiFi)';

function probeUploadUrl(): string {
  const ob = config.cdnObVersion || 'OB53';
  return `${CDNOPS_BASE}/upload/${ob}/ID/splash`;
}

function isLoginUrl(url: string): boolean {
  return /accounts\.google|garenanow\.com|bacchus|\/login/i.test(url);
}

export async function isCdnOpsLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (isLoginUrl(url)) return false;

  const uiChecks = [
    page.getByText('CDN OPS', { exact: false }),
    page.getByText(CDN_PORTAL_SELECTORS.loggedInNav, { exact: false }),
    page.getByText('All Files', { exact: false }),
    page.getByText('splash', { exact: true }),
    page.getByRole('button', { name: 'Upload', exact: true }),
    page.locator('table'),
  ];

  for (const locator of uiChecks) {
    if (await locator.first().isVisible().catch(() => false)) {
      return true;
    }
  }

  const hasStoredUser = await page
    .evaluate(() => {
      try {
        return Boolean(localStorage.getItem('userInfo'));
      } catch {
        return false;
      }
    })
    .catch(() => false);

  return hasStoredUser && url.includes('cdnops.jingle.cn');
}

async function hasLoginForm(page: Page): Promise<boolean> {
  if (isLoginUrl(page.url())) return true;
  const password = page.locator(CDN_PORTAL_SELECTORS.loginPassword).first();
  return password.isVisible().catch(() => false);
}

async function waitForPortalReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

export async function performCdnOpsLogin(page: Page): Promise<void> {
  const { cdnOpsUsername, cdnOpsPassword } = config;
  if (!cdnOpsUsername || !cdnOpsPassword) {
    throw new Error(CDN_OPS_AUTH_HELP);
  }

  await page.goto(CDNOPS_BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const username = page.locator(CDN_PORTAL_SELECTORS.loginUsername).first();
  const password = page.locator(CDN_PORTAL_SELECTORS.loginPassword).first();

  await username.waitFor({ state: 'visible', timeout: 15000 });
  await username.fill(cdnOpsUsername);
  await password.fill(cdnOpsPassword);

  const submit = page.locator(CDN_PORTAL_SELECTORS.loginSubmit).first();
  await submit.click();

  await waitForPortalReady(page);

  if (!(await isCdnOpsLoggedIn(page))) {
    throw new Error(
      'CDN OPS login failed — check CDNOPS_USERNAME / CDNOPS_PASSWORD or run npm run setup:cdnops-auth',
    );
  }
}

export function contextOptionsFromStorage(): {
  storageState?: string;
  userAgent: string;
} {
  const storagePath = config.cdnOpsStorageState;
  const options: { storageState?: string; userAgent: string } = {
    userAgent: CHROME_USER_AGENT,
  };
  if (storagePath && fs.existsSync(storagePath)) {
    options.storageState = storagePath;
  }
  return options;
}

export async function createAuthenticatedContext(
  browser: Browser,
): Promise<BrowserContext> {
  const options = contextOptionsFromStorage();

  if (!options.storageState && !config.cdnOpsUsername && !config.cdnOpsPassword) {
    throw new Error(CDN_OPS_AUTH_HELP);
  }

  const context = await browser.newContext(options);
  const page = await context.newPage();

  try {
    await page.goto(probeUploadUrl(), {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForPortalReady(page);

    if (await isCdnOpsLoggedIn(page)) {
      return context;
    }

    if (await hasLoginForm(page)) {
      if (options.storageState) {
        throw new Error(
          'CDN OPS session expired. Re-run: npm run setup:cdnops-auth',
        );
      }
      await performCdnOpsLogin(page);
      await page.goto(probeUploadUrl(), { waitUntil: 'domcontentloaded' });
      await waitForPortalReady(page);
      if (await isCdnOpsLoggedIn(page)) {
        return context;
      }
    }

    if (options.storageState) {
      throw new Error(
        'CDN OPS session loaded but portal did not open — re-run npm run setup:cdnops-auth on office WiFi, then restart the worker',
      );
    }

    throw new Error(CDN_OPS_AUTH_HELP);
  } finally {
    await page.close().catch(() => undefined);
  }
}
