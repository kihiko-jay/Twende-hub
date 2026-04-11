import { test, expect } from '@playwright/test';

test('login form shows "Forgot your password?" link', async ({ page }) => {
  await page.goto('/login');
  const forgotLink = page.getByRole('link', { name: /Forgot your password\?/i });
  await expect(forgotLink).toBeVisible();
});

test('submitting empty login form triggers HTML validation', async ({ page }) => {
  await page.goto('/login');

  const submit = page.getByRole('button', { name: /Login/i });
  await submit.click();

  const emailInput = page.locator('input[type="email"]');
  const isInvalid = await emailInput.evaluate((el) => el.matches(':invalid'));
  expect(isInvalid).toBeTruthy();
});

test('/forgot-password page loads and has email input + submit button', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByRole('button')).toBeVisible();
});

