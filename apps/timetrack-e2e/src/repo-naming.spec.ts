import {
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  defaultSettings,
  tempoWorklogOn,
} from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, seedWorld, test } from './support';

/** The branch rule that hands the keyless stretch's time to whatever else was open. */
const DONATING = {
  id: 'rule-donate',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'donate' as const },
  author: 'user' as const,
  createdAt: new Date(0),
};

const LINKED_TO_ABC = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

/** Five earlier days, two hours each, all on the one task the project's hours actually went to. */
const HISTORY = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-11'].map((day, index) =>
  tempoWorklogOn({ day, minutes: 120, issueId: E2E_PARENT_ID, id: `w-history-${index}`, description: 'SDK work' }),
);

const offer = (page: import('@playwright/test').Page) => page.locator(`[data-offer="${E2E_REPO}"]`);

const accept = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: `Always log fut-frontend on ${E2E_PARENT_KEY}` });

/**
 * The offer a checkout's own record makes: the user linked the checkout to a project and logged nearly
 * every hour of that project against one task, so the answer for the whole checkout is already written
 * down and the day only has to read it back.
 */
test.describe('the checkout-wide answer the record already holds', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [DONATING], projectLinks: [LINKED_TO_ABC] },
      tempo: { worklogs: HISTORY },
    });
    await page.goto('/day');
  });

  test('says which project the checkout files into, and what share of it sits on the issue', async ({ page }) => {
    await expect(offer(page)).toContainText('fut-frontend files into ABC');
    await expect(offer(page)).toContainText(`100% of your ABC time is on ${E2E_PARENT_KEY}`);
    await expect(offer(page)).toContainText('10h 0m over 5 days');
  });

  test('says that taking it replaces the rule that donates the time away', async ({ page }) => {
    await expect(offer(page)).toContainText('Taking this replaces the rule that donates its time.');
  });

  test('names the whole checkout on one click, and the day then logs against the issue', async ({ page }) => {
    await expect(page.locator(`[data-kind="row"][title^="${E2E_PARENT_KEY}"]`)).toHaveCount(0);

    await accept(page).click();

    await expect(page.locator(`[data-kind="row"][title^="${E2E_PARENT_KEY}"]`)).toHaveCount(1);
    await expect(offer(page)).toHaveCount(0);
  });

  test('writes nothing when the offer is turned down, and stops proposing it', async ({ page }) => {
    await page.getByRole('button', { name: 'Not this' }).click();

    await expect(offer(page)).toHaveCount(0);
    await expect(page.locator(`[data-kind="row"][title^="${E2E_PARENT_KEY}"]`)).toHaveCount(0);
  });

  test('offers nothing when no link says which project the checkout files into', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [DONATING] },
      tempo: { worklogs: HISTORY },
    });
    await page.goto('/day');

    await expect(offer(page)).toHaveCount(0);
  });

  test('offers nothing when the project spread its hours over many issues', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [DONATING], projectLinks: [LINKED_TO_ABC] },
      tempo: {
        worklogs: [
          ...HISTORY.slice(0, 2),
          ...['2026-08-06', '2026-08-07', '2026-08-11'].map((day, index) =>
            tempoWorklogOn({ day, minutes: 180, id: `w-other-${index}` }),
          ),
        ],
      },
    });
    await page.goto('/day');

    await expect(offer(page)).toHaveCount(0);
  });

  test('offers nothing for a checkout the user already named an issue for', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: {
        ...defaultSettings(),
        attributionRules: [{ ...DONATING, target: { kind: 'issue', issueKey: 'ABC-3010' } }],
        projectLinks: [LINKED_TO_ABC],
      },
      tempo: { worklogs: HISTORY },
    });
    await page.goto('/day');

    await expect(offer(page)).toHaveCount(0);
  });
});
