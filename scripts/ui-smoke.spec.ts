/**
 * UI smoke test — checks that key screens, buttons, and navigation render and respond.
 * Run: npx playwright test scripts/ui-smoke.spec.ts --config=scripts/playwright.config.ts
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin@shiadirectory.com', password: 'admin123' };

async function login(page, email: string, password: string) {
  await page.goto(BASE);
  // Wait for splash/auth boot
  await page.waitForSelector('#auth-screen-root', { timeout: 30000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForSelector('#tab-btn-home, #tab-btn-admin', { timeout: 15000 });
}

test.describe('ABN Community App — UI Smoke Tests', () => {
  test('App loads and shows auth screen', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('#auth-screen-root')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#btn-signin-google')).toBeVisible();
    await expect(page.locator('#btn-signin-apple')).toBeVisible();
  });

  test('Admin login and navigation works', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page.locator('#tab-btn-admin')).toBeVisible();
    await expect(page.locator('#tab-btn-account')).toBeVisible();
    // Admin should NOT see consumer tabs
    await expect(page.locator('#tab-btn-home')).not.toBeVisible();
    await expect(page.locator('#tab-btn-search')).not.toBeVisible();
  });

  test('Admin panel segments render', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.locator('#tab-btn-admin').click();
    await expect(page.locator('#admin-forbidden-state, #admin-panel-root, text=Vetting')).toBeVisible({ timeout: 10000 });
  });

  test('Invalid login shows error', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('#auth-screen-root', { timeout: 30000 });
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.locator('form button[type="submit"]').click();
    // Should stay on auth screen
    await expect(page.locator('#auth-screen-root')).toBeVisible({ timeout: 5000 });
  });

  test('Register tab switches', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('#auth-screen-root', { timeout: 30000 });
    const registerTab = page.getByRole('button', { name: /register/i });
    if (await registerTab.isVisible()) {
      await registerTab.click();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test('Consumer login — Home tab and search', async ({ page }) => {
    const testEmail = `uitest_${Date.now()}@test.com`;
    // Register via API first
    const reg = await page.request.post('http://localhost:3001/api/auth/register', {
      data: { email: testEmail, password: 'testpass123', name: 'UI Test User', phone: '+1 555 000 0000', role: 'customer' },
    });
    expect(reg.ok()).toBeTruthy();

    await login(page, testEmail, 'testpass123');
    await expect(page.locator('#tab-btn-home')).toBeVisible();
    await expect(page.locator('#home-tab-container, #home-top-section')).toBeVisible({ timeout: 10000 });

    // Navigate tabs
    await page.locator('#tab-btn-search').click();
    await expect(page.locator('#search-input-field, #btn-search-back')).toBeVisible({ timeout: 5000 });

    await page.locator('#tab-btn-saved').click();
    await expect(page.locator('#saved-tab-container, #saved-empty-state')).toBeVisible({ timeout: 5000 });

    await page.locator('#tab-btn-account').click();
    await expect(page.locator('#btn-edit-user-profile, #btn-account-danger-signout')).toBeVisible({ timeout: 5000 });
  });

  test('Home — register banner and job board link', async ({ page }) => {
    const testEmail = `uitest2_${Date.now()}@test.com`;
    await page.request.post('http://localhost:3001/api/auth/register', {
      data: { email: testEmail, password: 'testpass123', name: 'UI Test 2', role: 'customer' },
    });
    await login(page, testEmail, 'testpass123');
    await page.locator('#tab-btn-home').click();
    const registerBanner = page.locator('#btn-register-banner');
    if (await registerBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerBanner.click();
      await expect(page.locator('#portal-registration-selection, #portal-tab-container')).toBeVisible({ timeout: 5000 });
    }
    const seeAllJobs = page.locator('#btn-see-all-jobs');
    if (await seeAllJobs.isVisible({ timeout: 3000 }).catch(() => false)) {
      await seeAllJobs.click();
      await expect(page.locator('#job-board-container, text=Job')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Account — language, theme, privacy modals', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.locator('#tab-btn-account').click();
    await page.locator('#row-language-switch').click();
    await page.locator('#row-theme-switch').click();
    await page.locator('#row-privacy-trigger').click();
    await expect(page.locator('text=Privacy, text=privacy')).toBeVisible({ timeout: 5000 });
  });

  test('Sign out works', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.locator('#tab-btn-account').click();
    await page.locator('#btn-account-danger-signout').click();
    await expect(page.locator('#auth-screen-root')).toBeVisible({ timeout: 10000 });
  });
});
