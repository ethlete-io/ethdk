import { Page } from '@playwright/test';
import {
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  defaultSettings,
  tempoWorklogOn,
} from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, openStandIns, seedWorld, test } from './support';

const STAND_IN = {
  id: 'stand-in-revert',
  name: 'Revert unintended merge to main',
  state: 'open' as const,
  days: ['2026-08-12'],
  author: 'user' as const,
  createdAt: new Date(0),
};

const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: STAND_IN.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

const BOOKED_UNDER_ITS_NAME = tempoWorklogOn({
  day: '2026-08-11',
  minutes: 60,
  issueId: E2E_PARENT_ID,
  id: 'w-revert',
  description: 'Revert unintended merge to main',
});

const card = (page: Page) => page.locator(`ethlete-stand-ins-list [data-stand-in="${STAND_IN.id}"]`);

const offer = (page: Page) => card(page).locator(`[data-worklog-offer="${E2E_PARENT_KEY}"]`);

test.describe('a stand-in Tempo already holds a worklog for under its name', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [STAND_IN] },
      tempo: { worklogs: [BOOKED_UNDER_ITS_NAME] },
    });
    await page.goto('/day');
  });

  test('is offered that issue and stays open until the user takes it', async ({ page }) => {
    await openStandIns(page);

    await expect(offer(page)).toBeVisible();
    await expect(card(page)).not.toContainText('Resolved to');

    await offer(page)
      .getByRole('button', { name: `Resolve to ${E2E_PARENT_KEY}` })
      .click();

    await expect(card(page)).toContainText(`Resolved to ${E2E_PARENT_KEY}`);
    await expect(offer(page)).toHaveCount(0);
  });
});
