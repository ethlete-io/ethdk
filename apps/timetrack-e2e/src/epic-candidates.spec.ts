import { Page } from '@playwright/test';
import { E2E_ISSUE_ID, E2E_ISSUE_KEY, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { TimetrackSettings, shiftDayKey } from '@ethlete/timetrack';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  closeStandIns,
  editSurface,
  expect,
  openAutoModeReadout,
  openStandIns,
  readBackend,
  seedWorld,
  test,
} from './support';

const EPIC_KEY = 'ABC-9000';
const CHILD_KEY = 'ABC-12704';

const busyProject = () =>
  Array.from({ length: 100 }, (_, index) => ({
    id: `${30000 + index}`,
    key: `ABC-${20000 + index}`,
    summary: `Other work ${index}`,
    issueType: 'Task',
    updated: '2026-08-10T08:00:00.000Z',
  }));

const JIRA = {
  issues: [
    {
      id: E2E_ISSUE_ID,
      key: E2E_ISSUE_KEY,
      summary: 'User management',
      issueType: 'Task',
      updated: '2026-08-10T08:00:00.000Z',
    },
    { id: '29000', key: EPIC_KEY, summary: 'Rewards', issueType: 'Epic', updated: '2026-01-01T08:00:00.000Z' },
    {
      id: '29001',
      key: CHILD_KEY,
      summary: 'Reward pass claim flow',
      issueType: 'Story',
      parentKey: EPIC_KEY,
      updated: '2026-01-02T08:00:00.000Z',
    },
    {
      id: '29002',
      key: 'ABC-12705',
      summary: 'Reward shop layout',
      issueType: 'Story',
      parentKey: EPIC_KEY,
      status: 'Done',
      updated: '2026-01-02T08:00:00.000Z',
    },
    ...busyProject(),
  ],
};

const linked = (epicKeys?: string[]): TimetrackSettings => {
  const settings = defaultSettings();

  return {
    ...settings,
    reasoning: { ...settings.reasoning, autoMode: true },
    projectLinks: [
      {
        id: 'link-fut',
        path: E2E_REPO,
        target: { kind: 'project', projectKey: 'ABC', ...(epicKeys ? { epicKeys } : {}) },
        createdAt: new Date(0),
      },
    ],
  };
};

const expectTheEpicChildWaits = async (page: Page) => {
  await expect(page.locator('[data-band-approval][data-op="autoMode.apply"]')).toContainText(
    `Auto · Name ${CHILD_KEY}`,
  );

  await openStandIns(page);
  await expect(page.locator('ethlete-stand-ins-list [data-stand-in]').first()).toHaveAttribute('data-state', 'open');
  await closeStandIns(page);

  await page.locator('[data-kind="row"][data-stand-in][data-pending]').click();

  const section = editSurface(page).locator('[data-row-approval]');

  await expect(section).toContainText(`${CHILD_KEY} Reward pass claim flow`);
  await expect(section).toContainText('it names the same work');

  return section;
};

test.describe('auto mode in a checkout whose link names its epic', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: linked([EPIC_KEY]), jira: JIRA });
    await page.goto('/day');
  });

  test('offers the epic’s open child first, marked, with its parent summary', async ({ page }) => {
    const readout = await openAutoModeReadout(page);
    const call = readout.locator('[data-model-call]').filter({ hasText: '"standIn"' }).first();

    await call.locator('summary').click();

    const sent = call.locator('[data-model-call-sent]');

    await expect(sent).toContainText(CHILD_KEY);
    await expect(sent).toContainText('"inEpic":true');
    await expect(sent).toContainText('"parent":"Rewards"');
    await expect(sent).not.toContainText('ABC-12705');
  });

  test('queues the match the list alone found, and resolves the stand-in once approved', async ({ page }) => {
    const section = await expectTheEpicChildWaits(page);

    await section.getByRole('button', { name: 'Approve' }).click();
    await expect(section).toBeHidden();

    await openStandIns(page);

    const standIn = page.locator('ethlete-stand-ins-list [data-stand-in]').first();

    await expect(standIn).toHaveAttribute('data-state', 'resolved');
    await expect(standIn).toContainText(CHILD_KEY);
    expect((await readBackend(page)).jira.created).toEqual([]);
  });
});

test.describe('auto mode in a checkout whose link names no epic', () => {
  test('reads the epic from the parents of the issues the checkout was named with', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: linked(),
      jira: JIRA,
      reviewOverrides: {
        [shiftDayKey(E2E_DAY_KEY, -7)]: {
          'unnamed:@reward-shop': { issueKey: 'ABC-12705', laneKey: `repo:${E2E_REPO}` },
        },
      },
    });
    await page.goto('/day');

    const section = await expectTheEpicChildWaits(page);

    await expect(section.getByRole('button', { name: 'Approve' })).toBeVisible();
  });
});
