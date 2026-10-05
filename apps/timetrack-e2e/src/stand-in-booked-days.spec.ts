import { Page } from '@playwright/test';
import { AgentApiDayRows, CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_KEY, E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  editSurface,
  expect,
  openBand,
  openStandIns,
  pickIssue,
  seedWorld,
  test,
} from './support';

const BOOKED_DAYS = ['2026-08-10', '2026-08-11'];

const STAND_IN = {
  id: 'stand-in-bracket',
  name: 'Bracket challenge',
  state: 'open' as const,
  days: [...BOOKED_DAYS, E2E_DAY_KEY],
  author: 'user' as const,
  createdAt: new Date('2026-08-10T09:00:00.000Z'),
};

const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: STAND_IN.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

const keylessHourOn = (day: string): CollectedEvent[] => [
  {
    at: new Date(`${day}T11:00:00.000Z`),
    source: 'git',
    kind: 'git-checkout',
    repoPath: E2E_REPO,
    branch: E2E_KEYLESS_BRANCH,
  },
  {
    at: new Date(`${day}T11:01:00.000Z`),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: 'pdf-export.ts - fut-frontend - Visual Studio Code',
  },
  {
    at: new Date(`${day}T11:40:00.000Z`),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: E2E_KEYLESS_BRANCH,
    sha: 'd4e5f6a',
    subject: 'Try pdfkit for the invoice export',
  },
  { at: new Date(`${day}T12:00:00.000Z`), source: 'idle', kind: 'idle-start' },
];

const card = (page: Page) => page.locator('ethlete-stand-ins-list').locator(`[data-stand-in="${STAND_IN.id}"]`);

const band = (page: Page) => page.locator(`[data-kind="row"][title^="${STAND_IN.name}"]`);

const namingsOn = async (page: Page, day: string) => {
  const answer = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day });

  return answer.ok
    ? answer.value.rows
        .filter((row) => !row.hidden)
        .map((row) => ({ issueKey: row.issueKey, standInId: row.standInId }))
    : [];
};

test.describe('a stand-in whose earlier days are booked in Tempo by hand', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [...BOOKED_DAYS, E2E_DAY_KEY].flatMap(keylessHourOn),
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [STAND_IN] },
      tempoCoverage: Object.fromEntries(
        BOOKED_DAYS.map((day) => [day, { issues: [{ issueKey: E2E_ISSUE_KEY, coveredMs: 8 * 3_600_000 }] }]),
      ),
    });
    await page.goto('/day');
    await expect(band(page)).toHaveCount(1);
  });

  test('waits only on the day Tempo does not hold', async ({ page }) => {
    await openBand(page, (await band(page).getAttribute('title')) as string);

    await expect(editSurface(page).locator('[data-stand-in-waiting]')).toHaveText(/· 1 day\s*File its ticket/);
  });

  test('lists one day and asks the model about one day', async ({ page }) => {
    await openStandIns(page);

    await expect(card(page)).toContainText('on ');
    await expect(card(page)).not.toContainText('3 days');

    await card(page).getByRole('button', { name: 'File a ticket' }).click();

    const details = page.locator('ethlete-create-ticket details').filter({ hasText: 'What AI sees' });

    await details.locator('> summary').click();

    await expect(details.locator('pre')).toContainText('"days": 1');
  });

  test('moves only the unbooked day to the issue it resolves to', async ({ page }) => {
    const waiting = [{ issueKey: undefined, standInId: STAND_IN.id }];

    await expect.poll(() => namingsOn(page, BOOKED_DAYS[1] as string)).toEqual(waiting);

    await openStandIns(page);
    await pickIssue(page, card(page), /ABC-2000/);
    await expect(card(page)).toContainText('Resolved to ABC-2000');

    await expect.poll(() => namingsOn(page, E2E_DAY_KEY)).toEqual([{ issueKey: 'ABC-2000', standInId: undefined }]);
    expect(await namingsOn(page, BOOKED_DAYS[0] as string)).toEqual(waiting);
    expect(await namingsOn(page, BOOKED_DAYS[1] as string)).toEqual(waiting);
  });
});
