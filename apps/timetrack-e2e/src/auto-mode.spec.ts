import { E2E_PARENT_ID, E2E_PARENT_KEY, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { TimetrackSettings } from '@ethlete/timetrack';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  editSurface,
  expect,
  openApprovals,
  openStandIns,
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
