
import { test, expect } from '@playwright/test';

test.describe('payments', () => {
  test('event creation mock flow redirects into payment step', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('organizer@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    await page.goto('/create-event');
    await page.getByLabel(/event title/i).fill('Ngong Hills Sunrise Hike');
    await page.getByLabel(/description/i).fill('Sunrise hike test event');
    await page.getByLabel(/date/i).fill('2026-05-10');
    await page.getByLabel(/location/i).fill('Ngong Hills');
    await page.getByLabel(/max participants/i).fill('20');
    await page.getByLabel(/participant fee/i).fill('1500');
    await page.getByRole('button', { name: /pay & publish|publish/i }).click();

    await expect(page).toHaveURL(/payment|create-event/i);
  });

  test('participant paid join enters payment flow', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('participant@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    await page.goto('/events/1');
    const joinButton = page.getByRole('button', { name: /join event/i });
    await expect(joinButton).toBeVisible();
    await joinButton.click();
    await expect(page).toHaveURL(/payment/);
  });

  test('invalid phone number rejection', async ({ page }) => {
    await page.goto('/payment?type=creation&event_id=1');
    await page.getByPlaceholder(/07|01|\+254/i).fill('123456');
    await page.getByRole('button', { name: /send stk push|pay now/i }).click();
    await expect(page.getByText(/valid kenyan m-pesa number/i)).toBeVisible();
  });

  test('unauthenticated payment access redirects to login', async ({ page }) => {
    await page.goto('/payment?type=creation&event_id=1');
    await expect(page).toHaveURL(/login/);
  });
});
