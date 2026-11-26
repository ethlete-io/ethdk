import { E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, openDebug, readSavedReport, seedWorld, test } from './support';

type Saved = { anonymous: boolean; format: string; streams: { checkout?: string }[]; inputs?: { day: string } };

test.beforeEach(async ({ page }) => {
  await seedWorld(page, { now: E2E_NOW });
  await page.goto('/day');
});

const openModal = async (page: Parameters<typeof openDebug>[0]) => {
  const debug = await openDebug(page);

  await debug.locator('[data-report-export]').click();

  const modal = page.locator('[data-report-modal]');

  await expect(modal).toBeVisible();

  return modal;
};

const saved = async (page: Parameters<typeof openDebug>[0]) => {
  const file = await readSavedReport(page);

  return { name: file?.suggestedName, text: file?.text ?? '', report: JSON.parse(file?.text ?? 'null') as Saved };
};

test('saves an anonymous file by default and warns about nothing', async ({ page }) => {
  const modal = await openModal(page);

  await expect(modal.locator('[data-report-warning]')).toHaveCount(0);
  await page.locator('[data-report-save]').click();
  await expect(modal.locator('[data-report-result]')).toContainText('Saved to');

  const { name, text, report } = await saved(page);

  expect(name).toMatch(/^timetrack-anonymous-report-.*\.json$/);
  expect(report.anonymous).toBe(true);
  expect(report.format).toBe('timetrack-anonymous-report/1');
  expect(text).not.toContain(E2E_REPO);
  expect(report.inputs).toBeUndefined();
});

test('keeps the names and the raw inputs once anonymizing is turned off', async ({ page }) => {
  const modal = await openModal(page);

  await expect(modal.locator('[data-report-inputs]')).toHaveCount(0);
  await modal.locator('[data-report-anonymize] et-switch').click();
  await expect(modal.locator('[data-report-warning]')).toContainText('client names and issue keys');
  await modal.locator('[data-report-inputs] et-switch').click();
  await page.locator('[data-report-save]').click();
  await expect(modal.locator('[data-report-result]')).toContainText('Saved to');

  const { text, report } = await saved(page);

  expect(report.anonymous).toBe(false);
  expect(report.format).toBe('timetrack-debug-report/1');
  expect(text).toContain(E2E_REPO);
  expect(report.inputs?.day).toBeTruthy();
});
