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
    role: { id: string; name: string };
  };
}

/**
 * Log in via the API (fast path). Returns accessToken + user.
 *
 * Use this when you just need an authenticated session for subsequent API
 * calls and do NOT need to exercise the login UI.
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
 * Log in via the UI, exercising the complete form flow.
 *
 * Uses Radix Select so we click-to-open instead of using selectOption().
 * Waits for the /dashboard redirect on success.
 */
export async function loginViaUi(
  page: Page,
  credentials: LoginCredentials,
): Promise<void> {
  await page.goto('/login');

  // Radix Select: open trigger then pick option by role.
  const currentDocType = await page
    .locator('#documentType')
    .innerText()
    .catch(() => '');
  if (!currentDocType.includes(credentials.documentType)) {
    await page.locator('#documentType').click();
    await page
      .getByRole('option', { name: labelForDocumentType(credentials.documentType) })
      .click();
  }

  await page.locator('#documentNumber').fill(credentials.documentNumber);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: /ingresar al sistema/i }).click();

  await page.waitForURL(/\/(dashboard|cambiar-password|mi-obra)/, { timeout: 15_000 });
}

/**
 * Log out via the UI (opens user menu and clicks logout).
 */
export async function logoutViaUi(page: Page): Promise<void> {
  // Open user menu (topbar). The trigger is the avatar button.
  await page
    .getByRole('button', { name: /menú de usuario|user menu/i })
    .click()
    .catch(async () => {
      // Fallback: target by avatar image alt or class
      await page.locator('[aria-haspopup="menu"]').last().click();
    });
  await page.getByRole('menuitem', { name: /cerrar sesión|logout/i }).click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

/**
 * Inject an access token into localStorage so the frontend's Zustand auth store
 * picks it up on the next page load. Used by globalSetup + storageState flows.
 *
 * The app stores the token via useAuthStore (Zustand + persist to localStorage
 * under key 'kardex-auth'). Adjust if the store key changes.
 */
export async function injectAuthToken(page: Page, login: LoginResult): Promise<void> {
  await page.addInitScript((payload) => {
    window.localStorage.setItem(
      'kardex-auth',
      JSON.stringify({
        state: {
          accessToken: payload.accessToken,
          user: payload.user,
        },
        version: 0,
      }),
    );
  }, login);
}

function labelForDocumentType(type: DocumentType): string {
  switch (type) {
    case 'DNI':
      return 'DNI';
    case 'CE':
      return 'Carnet ext.';
    case 'PASAPORTE':
      return 'Pasaporte';
  }
}
