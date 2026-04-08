import { expect, test } from '@playwright/test';

const smokeRoutes = ['/', '/models', '/agents', '/agents/main', '/channels', '/skills', '/cron', '/settings'] as const;

for (const route of smokeRoutes) {
  test(`loads route ${route} without triggering error boundary`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
}
