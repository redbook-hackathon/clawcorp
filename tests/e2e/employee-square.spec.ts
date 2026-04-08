import { expect, test } from '@playwright/test';

test('opens the Employee Square create sheet', async ({ page }) => {
  await page.goto('/agents', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Agent/ })).toBeVisible();

  await page.getByRole('button', { name: /Add Agent/ }).click();
  await expect(page.getByRole('button', { name: /Create Agent/ })).toBeVisible();
  await expect(page.getByLabel('Name')).toBeVisible();
});

test('loads the dossier page for the main agent', async ({ page }) => {
  await page.goto('/agents/main', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Memory' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Skills' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Activity' })).toBeVisible();
});
