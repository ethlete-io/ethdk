import { Page } from '@playwright/test';
import { E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, openDebug, seedWorld, test } from './support';

type Report = { format: string; focusRow?: string; rows: { id: string }[]; streams: { checkout?: string }[] };

const clipboardReport = async (page: Page) =>
  JSON.parse(await page.evaluate(() => navigator.clipboard.readText())) as Report;

const repoName = E2E_REPO.split('/').pop() ?? '';

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seedWorld(page, { now: E2E_NOW });
  await page.goto('/day');
});

test('copies the day as a report that names no checkout', async ({ page }) => {
  const dialog = await openDebug(page);

  await dialog.getByRole('button', { name: 'Copy as anonymous report' }).click();
  await expect(dialog.locator('[data-report-copy]')).toHaveText('Copied the anonymous report');

  const report = await clipboardReport(page);
  const text = JSON.stringify(report);

  expect(report.format).toBe('timetrack-anonymous-report/1');
  expect(report.streams.some((stream) => stream.checkout === 'checkout-1')).toBe(true);
  expect(text).not.toContain(E2E_REPO);
  expect(text).not.toContain(repoName);
});

test('copies a band as the same report pointed at that band', async ({ page }) => {
  await page.locator('[data-lane] [data-kind="row"]').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy as anonymous report', exact: true }).click();

  await expect.poll(async () => (await clipboardReport(page).catch(() => null))?.focusRow).toMatch(/^row-\d+$/);

  const report = await clipboardReport(page);

  expect(report.rows.map((row) => row.id)).toContain(report.focusRow);
});
