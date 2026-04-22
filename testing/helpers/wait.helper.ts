import type { Page } from '@playwright/test';

import { apiGet } from './api.helper';

/**
 * Wait until the API's /health/live endpoint responds OK.
 * Useful at the start of a test suite to avoid race conditions with slow boots.
 */
export async function waitForApi(maxAttempts = 30, intervalMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await apiGet('/../health/live'); // bypass /api prefix
      if (response.status === 200) return;
    } catch {
      // API not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`API did not become ready after ${maxAttempts * intervalMs}ms`);
}

/**
 * Wait for a selector with a friendly timeout and error message.
 *
 * Prefer this over bare page.waitForSelector() inside tests — the failure
 * message tells you exactly what was being waited for.
 */
export async function waitForElement(
  page: Page,
  selector: string,
  { timeout = 5_000, description }: { timeout?: number; description?: string } = {},
): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch (error) {
    const label = description ?? selector;
    throw new Error(`Timed out waiting for ${label} (selector: ${selector})`);
  }
}

/**
 * Sleep helper. Use SPARINGLY — prefer explicit waits over sleeps.
 * Acceptable cases: waiting out a debounce, animation, scheduled job tick.
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
