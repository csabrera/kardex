import type { Page } from '@playwright/test';

import { apiPost, unwrap } from './api.helper';

export type DocumentType = 'DNI' | 'CE' | 'PASAPORTE';

export interface LoginCredentials {
  documentType: DocumentType;
  documentNumber: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    documentType: DocumentType;
    documentNumber: string;
    firstName: string;
    lastName: string;
    mustChangePassword: boolean;
  };
}

/**
 * Log in via the API (fast path).
 *
 * Use this when you just need an access token for subsequent API calls,
 * and do NOT need to exercise the login UI.
 *
 * Throws if login fails — tests shouldn't proceed past a failed setup.
 */
export async function loginViaApi(credentials: LoginCredentials): Promise<LoginResult> {
  const response = await apiPost('/auth/login', credentials);

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(
      `Login failed for ${credentials.documentType} ${credentials.documentNumber}: ` +
        `HTTP ${response.status} — ${JSON.stringify(response.data)}`,
    );
  }

  return unwrap<LoginResult>(response);
}

/**
 * Log in via the UI (complete flow).
 *
 * Use this when the login flow itself is under test.
 * For all other tests, prefer loginViaApi() + setTokenCookie().
 */
export async function loginViaUi(page: Page, credentials: LoginCredentials): Promise<void> {
  await page.goto('/login');
  await page.selectOption('select[name="documentType"]', credentials.documentType);
  await page.fill('input[name="documentNumber"]', credentials.documentNumber);
  await page.fill('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
  // Expect dashboard redirect
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

/**
 * Log out via the UI.
 */
export async function logoutViaUi(page: Page): Promise<void> {
  await page.click('[data-test="user-menu-trigger"]');
  await page.click('[data-test="logout-button"]');
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

/**
 * Attach an access token to the page context so authenticated requests
 * from the browser work immediately.
 *
 * Wired up after Fase 2A when the actual token storage strategy is decided.
 */
export async function setTokenCookie(page: Page, _token: string): Promise<void> {
  // TODO(Fase 2A): Implement once auth storage strategy is finalized.
  // Likely: await page.context().addCookies([{ name: 'refresh_token', ... }])
  // + set Zustand store via localStorage injection.
  await page.goto('/'); // Placeholder
}
