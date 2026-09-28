import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { TimetrackSettings } from '@ethlete/timetrack';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  expect,
  openApprovals,
  openStandIns,
  readBackend,
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

type DayRows = { rows: { issueKey?: string; sources: { issue: string } }[] };

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
});
