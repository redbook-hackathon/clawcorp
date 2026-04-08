import { expect, test } from '@playwright/test';

test('loads the workbench and opens the session drawer in browser preview mode', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByRole('button', { name: /Files/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Session/ })).toBeVisible();

  await page.getByRole('button', { name: /Session/ }).click();
  await expect(page.getByText('agent:main:main').first()).toBeVisible();
});
