import { expect, test } from '@playwright/test';
import { createProfile } from './helpers';

test('mobile navigation, More menu and layout without horizontal overflow', async ({ page }) => {
  await createProfile(page, 'Asha Rao');
  await page.getByRole('button', { name: 'Explore with sample data' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Asha');

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'Shopping' }).click();
  await expect(page).toHaveURL(/\/shopping/);
  await nav.getByRole('button', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Bills & Expenses' }).click();
  await expect(page).toHaveURL(/\/finance\/bills/);

  for (const path of ['/', '/inventory', '/shopping', '/tasks', '/finance/bills', '/finance/reports', '/maintenance', '/calendar', '/documents', '/members', '/settings/profile']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});
