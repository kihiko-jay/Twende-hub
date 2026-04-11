import { test, expect } from '@playwright/test';

test('home page loads with adventures or an empty state', async ({ page }) => {
  await page.goto('/');

  // Wait for hero to ensure initial render
  await expect(
    page.getByRole('heading', { name: /Run Professional Outdoor Events/i }),
  ).toBeVisible();

  const eventLinks = page.locator('a[href^="/events/"]');
  const count = await eventLinks.count();

  if (count > 0) {
    await expect(eventLinks.first()).toBeVisible();
  } else {
    await expect(
      page.getByText(/No adventures found|Loading adventures|No events found/i),
    ).toBeVisible();
  }
});

test('login page shows login form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
  await expect(page.getByLabel(/Email Address/i)).toBeVisible();
  await expect(page.getByLabel(/Password/i)).toBeVisible();
});

test('register page shows register form', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /Join TwendeHub/i })).toBeVisible();
  await expect(page.getByLabel(/Full Name/i)).toBeVisible();
  await expect(page.getByLabel(/Email Address/i)).toBeVisible();
});

test('unauthenticated admin visit redirects to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
});

test.describe('mobile navigation menu', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('hamburger menu opens and closes', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /Toggle navigation/i });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.getByText(/Explore Trips/i)).toBeVisible();

    await toggle.click();
    await expect(page.getByText(/Explore Trips/i)).toBeHidden();
  });
});

test('pricing, terms, and privacy routes load', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText(/Pricing/i)).toBeVisible();

  await page.goto('/terms');
  await expect(page.getByText(/Terms/i)).toBeVisible();

  await page.goto('/privacy');
  await expect(page.getByText(/Privacy/i)).toBeVisible();
});

test('unknown route shows 404 trail message', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(
    page.getByText(/trail doesn['’]t exist/i),
  ).toBeVisible();
});

