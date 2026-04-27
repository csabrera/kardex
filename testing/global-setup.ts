import { chromium, type FullConfig, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';

const STORAGE_STATE_FILE = path.join(__dirname, '.auth', 'admin.json');

/**
 * Runs once before all tests. Logs in as the dev admin and saves the
 * authenticated storage state (cookies + localStorage) to a file.
 *
 * Each test project can then point its `use.storageState` at that file to
 * skip the login UI and start already authenticated.
 *
 * Tests that exercise the login flow itself should NOT use storageState and
 * must call page.context().clearCookies() + page.goto('/login') in their setup.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const API_URL = process.env.API_URL ?? 'http://localhost:4000';
  const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
  const documentType = process.env.E2E_ADMIN_DOC_TYPE ?? 'DNI';
  const documentNumber = process.env.E2E_ADMIN_DOC_NUMBER ?? '12345678';
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'CambiarEn_PrimerLogin_2026';

  console.log(`[global-setup] Logging in as ${documentType} ${documentNumber}...`);

  // Step 1: Call /auth/login via Playwright's request fixture so cookies land
  // in a context we can reuse.
  // Note: trailing slash on baseURL + relative path is required so Playwright's
  // URL resolution preserves the /api prefix (it would otherwise replace it).
  const requestContext = await request.newContext({ baseURL: `${API_URL}/api/` });
  const loginRes = await requestContext.post('auth/login', {
    data: { documentType, documentNumber, password },
    failOnStatusCode: false,
  });

  if (loginRes.status() !== 200 && loginRes.status() !== 201) {
    const body = await loginRes.text();
    throw new Error(
      `[global-setup] Login failed (HTTP ${loginRes.status()}): ${body}\n\n` +
        `Check E2E_ADMIN_* env vars in testing/.env.local.\n` +
        `Make sure the admin exists and mustChangePassword is false (log in once and change password if needed).`,
    );
  }

  const loginBody = (await loginRes.json()) as {
    data: {
      accessToken: string;
      user: { mustChangePassword: boolean; firstName: string };
    };
  };

  if (loginBody.data.user.mustChangePassword) {
    throw new Error(
      `[global-setup] Admin ${documentNumber} still has mustChangePassword=true.\n` +
        `Log in manually once to change the password, then update E2E_ADMIN_PASSWORD in testing/.env.local.`,
    );
  }

  console.log(
    `[global-setup] Logged in as ${loginBody.data.user.firstName}. Saving storageState...`,
  );

  // Step 2: Launch a browser, warm up the web app so the refresh cookie
  // (set by step 1) hydrates the session, then save state.
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: await requestContext.storageState(),
    baseURL: WEB_URL,
  });
  const page = await context.newPage();

  // Prime localStorage with user info so SessionInitializer has a hint.
  await page.goto(WEB_URL);
  await page.evaluate((user) => {
    window.localStorage.setItem(
      'kardex-auth',
      JSON.stringify({ state: { user }, version: 0 }),
    );
  }, loginBody.data.user);

  // Navigate to dashboard — SessionInitializer will refresh the access token
  // from the httpOnly cookie, so we land authenticated.
  await page.goto(`${WEB_URL}/dashboard`);
  await page.waitForURL(/\/dashboard|\/mi-obra/, { timeout: 15_000 });

  await fs.mkdir(path.dirname(STORAGE_STATE_FILE), { recursive: true });
  await context.storageState({ path: STORAGE_STATE_FILE });

  console.log(`[global-setup] storageState saved to ${STORAGE_STATE_FILE}`);

  await context.close();
  await browser.close();
  await requestContext.dispose();
}

export default globalSetup;
export { STORAGE_STATE_FILE };
