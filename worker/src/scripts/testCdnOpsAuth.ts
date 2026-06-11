import { chromium } from 'playwright';
import { createAuthenticatedContext } from '../pipeline/cdnOpsAuth.js';

const browser = await chromium.launch({ headless: true });
try {
  await createAuthenticatedContext(browser);
  console.log('CDN OPS auth OK');
} catch (err) {
  console.error('CDN OPS auth FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await browser.close();
}
