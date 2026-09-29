import { Page } from '@playwright/test';
import {
  E2E_ISSUE_BRANCH,
  E2E_ISSUE_KEY,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  E2E_REPO,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { CollectedEvent, TimetrackSettings } from '@ethlete/timetrack';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  editSurface,
  expect,
  openApprovals,
  openAutoModeReadout,
  openStandIns,
  queuedId,
  readBackend,
  readStoredSettings,
  seedWorld,
  test,
} from './support';

const LINKS_THE_CHECKOUT = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

const withAutoMode = (settings: TimetrackSettings): TimetrackSettings => ({
  ...settings,
  reasoning: { ...settings.reasoning, autoMode: true },
});

const openSuggestions = async (page: Page) => {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Suggestions' }).click();
};

type DayRows = {
  rows: { issueKey?: string; description: string; sources: { issue: string; description: string } }[];
};

const FAKE_WORKLOG = 'Worked by the fake agent.';

const describedRow = async (page: Page) => {
  const answer = await askAgent<DayRows>(page, { op: 'day.rows', day: E2E_DAY_KEY });

  if (!answer.ok) return undefined;

  const row = answer.value.rows.find((entry) => entry.issueKey === E2E_ISSUE_KEY);

  return row && { description: row.description, source: row.sources.description };
};

test.describe('auto mode on a band no issue matches', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: withAutoMode(defaultSettings()) });
    await page.goto('/day');
  });

  test('queues one create from auto mode and names the band once it is approved', async ({ page }) => {
    const dialog = await openApprovals(page);
    const item = dialog.locator('[data-approval]');

    await expect(item).toHaveCount(1);
    await expect(item).toContainText('Files a Jira issue in ABC: Drafted');
    await expect(item).toContainText('auto mode');
    expect((await readBackend(page)).jira.created).toEqual([]);

    await item.getByRole('button', { name: 'Approve' }).click();
    await expect(item).toBeHidden();

    const [created] = (await readBackend(page)).jira.created;

    expect(created?.summary).toMatch(/^Drafted/);

    await expect
      .poll(async () => {
        const answer = await askAgent<DayRows>(page, { op: 'day.rows', day: E2E_DAY_KEY });

        return answer.ok ? answer.value.rows.filter((row) => row.sources.issue === 'auto').length : 0;
      })
      .toBeGreaterThan(0);

    const band = page.locator(`[data-kind="row"][title^="${created?.key ?? ''} "]`).first();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await band.click();
    await expect(editSurface(page).locator('[data-auto-named]')).toBeVisible();
  });
});

test.describe('auto mode on a stand-in of today', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: withAutoMode({ ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] }),
    });
    await page.goto('/day');
  });

  test('resolves it with the issue the match found and files nothing', async ({ page }) => {
    await openStandIns(page);

    await expect(page.locator('ethlete-stand-ins-list [data-stand-in]').first()).toContainText('by auto mode');
    await expect(page.getByRole('button', { name: 'Review requests' })).toBeHidden();
    expect((await readBackend(page)).jira.created).toEqual([]);
  });

  test('reads out the stand-in it resolved', async ({ page }) => {
    const readout = await openAutoModeReadout(page);

    const applied = readout.locator('[data-auto-entry][data-status="applied"]');

    await expect(applied).toHaveCount(1);
    await expect(applied).toContainText('applied');
  });

  test('lists the ask it ran this session as done', async ({ page }) => {
    const activity = await openAutoModeReadout(page);

    await expect(
      activity.locator('[data-auto-activity][data-state="done"]').filter({ hasText: 'Asks about' }),
    ).toHaveCount(1);
  });
});

test.describe('a class the settings make stricter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('keeps a CLI create out of approve all once it is set to one by one', async ({ page }) => {
    const id = queuedId(
      await askAgent(page, { op: 'jira.create', summary: 'Pdf export', projectKey: 'ABC', client: 'Claude Code' }),
    );

    await openSuggestions(page);
    await page.locator('[data-action="jira.create"] et-select').click();
    await page.getByRole('option', { name: 'Approved one by one' }).click();

    await expect
      .poll(async () => (await readStoredSettings(page))?.actionClasses)
      .toEqual({ 'jira.create': 'human-only' });

    const dialog = await openApprovals(page);

    await expect(dialog.locator(`[data-approval="${id}"]`)).toContainText('Only approved one by one');
    await expect(dialog.getByRole('button', { name: /^Approve all/ })).toBeHidden();
  });
});

test.describe('the parent the ticket form of a stand-in fills in by itself', () => {
  const UPDATED = `${E2E_DAY_KEY}T08:00:00.000Z`;
  const SUGGESTED = 'ABC-2100';

  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      jira: {
        issues: [
          {
            id: E2E_PARENT_ID,
            key: E2E_PARENT_KEY,
            summary: 'Member onboarding',
            issueType: 'Story',
            updated: UPDATED,
          },
          { id: '10210', key: SUGGESTED, summary: 'Pdf export tooling', issueType: 'Story', updated: UPDATED },
        ],
      },
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
  });

  test('is never stored as the user’s pick, which only a pick in the select is', async ({ page }) => {
    await openStandIns(page);

    const card = page.locator('ethlete-stand-ins-list [data-stand-in]').first();
    const parent = card.locator('et-form-field').filter({ hasText: 'Parent' }).locator('et-select');
    const storedParent = async () => {
      const [standIn] = (await readStoredSettings(page))?.standIns ?? [];

      return { parentKey: standIn?.parentKey, parentSource: standIn?.parentSource };
    };

    await card.getByRole('button', { name: 'File a ticket' }).click();
    await expect(parent).toContainText(SUGGESTED);
    await page.clock.runFor(1_000);

    expect(await storedParent()).toEqual({ parentKey: undefined, parentSource: undefined });

    await parent.click();
    await page.getByRole('option', { name: new RegExp(E2E_PARENT_KEY) }).click();

    await expect.poll(storedParent).toEqual({ parentKey: E2E_PARENT_KEY, parentSource: 'human' });
  });
});

test.describe('the sidebar line of auto mode', () => {
  const statusLine = (page: Page) => page.locator('ethlete-sidebar [data-auto-mode-status]');

  test('shows auto mode on with its waiting count and opens the queue', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: withAutoMode(defaultSettings()) });
    await page.goto('/day');

    await expect(statusLine(page)).toHaveText('Auto mode · on · 1 waiting');
    await statusLine(page).click();
    await expect(page.locator('ethlete-approval-queue [data-approval]')).toHaveCount(1);
  });

  test('stays out of the sidebar while auto mode is off', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: defaultSettings() });
    await page.goto('/day');

    await expect(page.getByRole('link', { name: /Settings/ })).toBeVisible();
    await expect(statusLine(page)).toHaveCount(0);
  });
});

test.describe('auto mode on a settled code row with a ticket', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: withAutoMode(defaultSettings()) });
    await page.goto('/day');
  });

  test('writes its worklog description and reads it out', async ({ page }) => {
    await expect.poll(() => describedRow(page)).toEqual({ description: FAKE_WORKLOG, source: 'auto' });

    const readout = await openAutoModeReadout(page);
    const entry = readout.locator('[data-auto-entry^="description:"]');

    await expect(entry).toHaveCount(1);
    await expect(entry).toHaveAttribute('data-status', 'written');
    await expect(entry).toContainText(`Worklog: ${FAKE_WORKLOG}`);
  });
});

test.describe('auto mode on a code row that has not settled yet', () => {
  const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);
  const focus = (clock: string, title: string): CollectedEvent => ({
    at: at(clock),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title,
  });

  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: at('10:58'),
      // Every collector run reloads the day, which asks again by itself. Paused, only the clock can.
      collectionPausedAt: at('10:40'),
      events: [
        { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
        focus('09:01', 'user-management.ts - fut-frontend - Visual Studio Code'),
        focus('09:25', 'invite.ts - fut-frontend - Visual Studio Code'),
        focus('09:50', 'invite.spec.ts - fut-frontend - Visual Studio Code'),
        focus('10:15', 'member.ts - fut-frontend - Visual Studio Code'),
        { at: at('10:30'), source: 'idle', kind: 'idle-start' },
      ],
      settings: withAutoMode(defaultSettings()),
    });
    await page.goto('/day');
  });

  test('describes it once the clock alone has carried it past the settle time', async ({ page }) => {
    await expect.poll(() => describedRow(page)).toBeDefined();
    await page.clock.runFor(2_000);

    expect((await describedRow(page))?.source).not.toBe('auto');

    await page.clock.runFor('04:00');

    await expect.poll(() => describedRow(page)).toEqual({ description: FAKE_WORKLOG, source: 'auto' });
  });
});
