import { expect, test } from '@playwright/test';

test.describe('Smoke — Home page', () => {
  test('home page loads successfully', async ({ page }) => {
    await page.goto('/');

    // Brand name should be visible
    await expect(page.getByRole('heading', { name: /Kardex/i }).first()).toBeVisible();

    // Tagline
    await expect(page.getByText(/Inventario inteligente/i)).toBeVisible();

    // Primary CTA should route to login
    const loginCta = page.getByRole('link', { name: /Ingresar al sistema/i });
    await expect(loginCta).toBeVisible();
    await expect(loginCta).toHaveAttribute('href', '/login');

    // Feature cards should be present (all 4)
    await expect(page.getByText('Gestión de Inventario')).toBeVisible();
    await expect(page.getByText('Control de Accesos')).toBeVisible();
    await expect(page.getByText('Auditoría Completa')).toBeVisible();
    await expect(page.getByText('Tiempo Real')).toBeVisible();
  });

  test('404 page renders when route does not exist', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);

    await expect(page.getByRole('heading', { name: /Página no encontrada/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible();
  });

  test('dark mode CSS variables are present', async ({ page }) => {
    await page.goto('/');

    // Inter font should be loaded (via next/font)
    const body = page.locator('body');
    const fontFamily = await body.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });
    expect(fontFamily.toLowerCase()).toContain('inter');

    // Theme class should resolve from next-themes (dark or light)
    const html = page.locator('html');
    const classList = await html.getAttribute('class');
    expect(classList).toMatch(/(dark|light)/);
  });
});
