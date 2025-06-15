import { test, expect } from '@playwright/test';
import { symphony } from '@symphony/playwright';

// You can use Symphony in individual tests
test('measure request performance', async ({ page }) => {
  // Enable Symphony for this page with test name
  await symphony.enable(page, 'measure-request-performance');

  // Navigate to a page
  await page.goto('https://example.com');

  // Verify the page loaded
  await expect(page).toHaveTitle(/Example Domain/);

  // Get request timing metrics
  const metrics = symphony.getMetrics();
  console.log('Request metrics:', metrics);

  // Verify we captured some metrics
  expect(metrics.length).toBeGreaterThan(0);

  // Get and log the summary
  const summary = symphony.getSummary();
  console.log('Test summary:', summary);
});

// Or use it in a test group
test.describe('Performance tests', () => {
  // Enable Symphony for all tests in this group
  test.beforeEach(async ({ page }, testInfo) => {
    await symphony.enable(page, testInfo.title);
  });

  test('first test', async ({ page }) => {
    await page.goto('https://example.com');
    const summary = symphony.getSummary();
    console.log('First test summary:', summary);
  });

  test('second test', async ({ page }) => {
    await page.goto('https://example.org');
    const summary = symphony.getSummary();
    console.log('Second test summary:', summary);
  });
}); 