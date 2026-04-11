import { test, expect } from '@playwright/test';

test('home shows event cards or a clean empty state', async ({ page }) => {
  await page.goto('/');

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

test('search input debounces without crashing', async ({ page }) => {
  await page.goto('/');

  const searchInput = page.getByPlaceholder(/Search adventures|Search events/i);
  await searchInput.fill('kenya');
  await page.waitForTimeout(500);

  await expect(searchInput).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Run Professional Outdoor Events/i }),
  ).toBeVisible();
});

test('clicking an event card navigates to event detail when events exist', async ({ page }) => {
  await page.goto('/');

  const eventLinks = page.locator('a[href^="/events/"]');
  const count = await eventLinks.count();

  if (count === 0) {
    // No events to click; ensure empty state is present instead.
    await expect(
      page.getByText(/No adventures found|No events found/i),
    ).toBeVisible();
    return;
  }

  await eventLinks.first().click();
  await expect(page).toHaveURL(/\/events\//);
  await expect(page.getByRole('heading')).toBeVisible();
});

