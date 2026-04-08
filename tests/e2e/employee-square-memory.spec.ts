import { expect, test } from '@playwright/test';

test('honors the agent memory deep link', async ({ page }) => {
  await page.goto('/agents/main?tab=memory', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Memory' })).toHaveAttribute('aria-selected', 'true');
});
