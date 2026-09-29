import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  closeStandIns,
  editSurface,
  expect,
  openBand,
  openStandIns,
  seedWorld,
  test,
} from './support';

const standIn = (id: string, name: string, days: string[]) => ({
  id,
  name,
  state: 'open' as const,
  days,
  author: 'user' as const,
  createdAt: new Date('2026-07-01T09:00:00.000Z'),
});

const CURRENT = standIn('stand-in-current', 'The export nobody filed yet', [E2E_DAY_KEY]);
const STALE = standIn('stand-in-stale', 'A spike from July', ['2026-07-02']);

const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: CURRENT.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

test.describe('a stand-in that took no band for weeks', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [CURRENT, STALE] },
    });
    await page.goto('/day');
  });

  test('is marked stale, and one press hides it from the list', async ({ page }) => {
    const list = await openStandIns(page);

    await expect(list.locator(`[data-stand-in="${STALE.id}"] [data-stale]`)).toBeVisible();
    await expect(list.locator(`[data-stand-in="${CURRENT.id}"] [data-stale]`)).toHaveCount(0);

    await page.getByRole('button', { name: 'Hide 1 stale' }).click();

    await expect(list.locator(`[data-stand-in="${STALE.id}"]`)).toHaveCount(0);

    await page.getByRole('button', { name: 'Show 1 hidden' }).click();
    await list.locator(`[data-stand-in="${STALE.id}"]`).getByRole('button', { name: 'Show again' }).click();

    await expect(list.locator(`[data-stand-in="${STALE.id}"]`)).not.toHaveAttribute('data-hidden');
  });

  test('is no longer offered as a name once hidden', async ({ page }) => {
    const list = await openStandIns(page);

    await list.locator(`[data-stand-in="${STALE.id}"]`).getByRole('button', { name: 'Hide' }).click();
    await closeStandIns(page);

    const title = await page.locator(`[data-kind="row"][title^="${CURRENT.name}"]`).getAttribute('title');

    await openBand(page, title as string);
    await editSurface(page).getByLabel('A name you gave this work').click();

    await expect(page.getByRole('option', { name: CURRENT.name })).toBeVisible();
    await expect(page.getByRole('option', { name: STALE.name })).toHaveCount(0);
  });
});

test.describe('an open stand-in whose every day is booked in Tempo', () => {
  const BOOKED = standIn('stand-in-booked', 'Booked by hand in Tempo', ['2026-07-02', '2026-07-03']);
  const PARTLY = standIn('stand-in-partly', 'Half of it still open', ['2026-07-02', '2026-07-06']);

  test('is filed with the hidden ones and carries a booked label', async ({ page }) => {
    const covered = { issues: [{ issueKey: 'ET-772', coveredMs: 3_600_000 }] };

    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), standIns: [BOOKED, PARTLY] },
      tempoCoverage: { '2026-07-02': covered, '2026-07-03': covered },
    });
    await page.goto('/day');

    const list = await openStandIns(page);

    await expect(list.locator(`[data-stand-in="${BOOKED.id}"]`)).toHaveCount(0);
    await expect(list.locator(`[data-stand-in="${PARTLY.id}"]`)).toBeVisible();
    await expect(list.locator(`[data-stand-in="${PARTLY.id}"] [data-booked]`)).toHaveCount(0);

    await page.getByRole('button', { name: 'Show 1 hidden' }).click();

    const booked = list.locator(`[data-stand-in="${BOOKED.id}"]`);

    await expect(booked.locator('[data-booked]')).toHaveText('Booked in Tempo');
    await expect(booked.getByRole('button', { name: 'Show again' })).toHaveCount(0);
  });
});
