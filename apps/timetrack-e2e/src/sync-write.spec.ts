import { Page } from '@playwright/test';
import { E2E_ISSUE_ID } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, logTheNamedRow, readBackend, seedWorld, test } from './support';

/**
 * The only flow in the app that writes to somebody else's system. Every assertion here reads the fake
 * backend at the wire: what the screen says is a second, weaker check.
 */
const planTheNamedRow = async (page: Page) => {
  await page.goto('/day');
  await logTheNamedRow(page);
  await page.getByRole('link', { name: 'Sync' }).click();
  await page.getByRole('button', { name: 'Plan this day' }).click();
};

const writeButton = (page: Page) => page.getByRole('button', { name: 'Write 1 change to Tempo' });

test.describe('writing the day to tempo', () => {
  test('creates in tempo exactly the time the reviewed row names', async ({ page }) => {
    await planTheNamedRow(page);
    await writeButton(page).click();

    await expect(page.getByRole('heading', { name: 'Last write' })).toBeVisible();

    const backend = await readBackend(page);

    expect(backend.tempo.writes).toEqual([
      { kind: 'create', worklogId: expect.any(String), issueId: E2E_ISSUE_ID, timeSpentSeconds: 5400 },
    ]);
    expect(backend.tempo.worklogs).toEqual([
      expect.objectContaining({
        issueId: E2E_ISSUE_ID,
        startDate: '2026-08-12',
        startTime: '09:00:00',
        timeSpentSeconds: 5400,
      }),
    ]);
  });

  test('plans nothing to write on a second run of the same unchanged day', async ({ page }) => {
    await planTheNamedRow(page);
    await writeButton(page).click();
    await expect(page.getByRole('heading', { name: 'Last write' })).toBeVisible();

    await page.getByRole('button', { name: 'Plan again' }).click();

    await expect(page.getByText('As E2E — 0 write(s), 1 already in Tempo')).toBeVisible();
    await expect(page.getByText('Every reviewed row on this day already matches what Tempo holds.')).toBeVisible();
    await expect(writeButton(page)).toBeHidden();
    expect((await readBackend(page)).tempo.writes).toHaveLength(1);
  });

  test('names the refusal on the row tempo rejected, and leaves tempo empty', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, faults: [{ url: '/worklogs', method: 'POST', status: 401 }] });
    await planTheNamedRow(page);
    await writeButton(page).click();

    await expect(page.getByText('Tempo rejected the token (401)')).toBeVisible();

    const backend = await readBackend(page);

    expect(backend.tempo.worklogs).toEqual([]);
    expect(backend.tempo.writes).toEqual([]);
  });

  test('offers the refused row again, and writes it once when tempo takes it', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      faults: [{ url: '/worklogs', method: 'POST', status: 401, times: 1 }],
    });
    await planTheNamedRow(page);
    await writeButton(page).click();

    await page.getByRole('button', { name: 'Retry 1 row' }).click();

    await expect(page.getByText('Tempo rejected the token (401)')).toBeHidden();

    const backend = await readBackend(page);

    expect(backend.tempo.writes).toEqual([
      { kind: 'create', worklogId: expect.any(String), issueId: E2E_ISSUE_ID, timeSpentSeconds: 5400 },
    ]);
  });
});
