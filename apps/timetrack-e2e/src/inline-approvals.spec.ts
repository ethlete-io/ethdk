import { Page } from '@playwright/test';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { TimetrackSettings } from '@ethlete/timetrack';
import { E2E_DAY_KEY, E2E_NOW, askAgent, editSurface, expect, queuedId, readBackend, seedWorld, test } from './support';

const withAutoMode = (settings: TimetrackSettings): TimetrackSettings => ({
  ...settings,
  reasoning: { ...settings.reasoning, autoMode: true },
});

const bandChip = (page: Page, op: string) => page.locator(`[data-band-approval][data-op="${op}"]`);
const pill = (page: Page) => page.locator('[data-waiting-pill]');

type DayRows = { rows: { issueKey?: string; fromMs: number; toMs: number }[] };

test.describe('a create auto mode queued for a band', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: withAutoMode(defaultSettings()) });
    await page.goto('/day');
  });

  test('previews on the band and files once its chip is approved', async ({ page }) => {
    const chip = bandChip(page, 'jira.create');

    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText('Auto · File ABC');
    await expect(page.locator('[data-kind="row"][data-pending]')).toHaveCount(1);
    await expect(pill(page)).toBeHidden();
    expect((await readBackend(page)).jira.created).toEqual([]);

    await chip.getByRole('button', { name: /^Approve:/ }).click();

    await expect(chip).toBeHidden();
    await expect(page.getByRole('button', { name: 'Review requests' })).toBeHidden();
    expect((await readBackend(page)).jira.created.map((issue) => issue.summary)).toEqual([
      expect.stringMatching(/^Drafted/),
    ]);
  });

  test('files nothing once its chip is rejected', async ({ page }) => {
    const chip = bandChip(page, 'jira.create');

    await chip.getByRole('button', { name: /^Reject:/ }).click();

    await expect(chip).toBeHidden();
    await expect(page.locator('[data-kind="row"][data-pending]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Review requests' })).toBeHidden();
    expect((await readBackend(page)).jira.created).toEqual([]);
  });

  test('shows what it would file in the edit surface of the band', async ({ page }) => {
    await page.locator('[data-kind="row"][data-pending]').click();

    const section = editSurface(page).locator('[data-row-approval]');

    await expect(section).toContainText('Auto mode suggests');
    await expect(section).toContainText(/New issue\s*Drafted/);
    await expect(section).toContainText('auto mode at');

    await section.getByRole('button', { name: 'Approve' }).click();

    await expect(section).toBeHidden();
    await expect.poll(async () => (await readBackend(page)).jira.created.length).toBe(1);
  });
});

test.describe('a write with no band on the day in view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('waits behind the header pill, not on a band', async ({ page }) => {
    const id = queuedId(
      await askAgent(page, {
        op: 'worklog.add',
        issueKey: 'ABC-1',
        description: 'Yesterday',
        fromMs: new Date(E2E_NOW).getTime() - 24 * 3_600_000,
        durationMs: 900_000,
        client: 'Claude Code',
      }),
    );

    await expect(pill(page)).toHaveText('1 more waiting');
    await expect(bandChip(page, 'worklog.add')).toHaveCount(0);

    await pill(page).click();
    await expect(page.locator(`ethlete-approval-queue [data-approval="${id}"]`)).toContainText(
      'Adds a 15m row for ABC-1 to the day',
    );
  });

  test('keeps a tempo sync out of approve all', async ({ page }) => {
    const created = queuedId(
      await askAgent(page, { op: 'jira.create', summary: 'Pdf export', projectKey: 'ABC', client: 'Claude Code' }),
    );
    const synced = queuedId(await askAgent(page, { op: 'tempo.sync', day: E2E_DAY_KEY, planHash: 'confirmed' }));

    await expect(pill(page)).toHaveText('2 more waiting');
    await pill(page).click();

    const dialog = page.locator('ethlete-approval-queue');

    await dialog.getByRole('button', { name: 'Approve all (1)' }).click();

    await expect(dialog.locator(`[data-approval="${created}"]`)).toBeHidden();
    await expect(dialog.locator(`[data-approval="${synced}"]`)).toContainText('Only approved one by one');
    expect((await readBackend(page)).tempo.writes).toEqual([]);
  });
});

test.describe('a worklog add on a row of the day', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('previews on that row with its span on the clock', async ({ page }) => {
    const answer = await askAgent<DayRows>(page, { op: 'day.rows', day: E2E_DAY_KEY });
    const row = (answer as { value?: DayRows }).value?.rows.find((entry) => entry.issueKey);

    expect(row).toBeDefined();

    queuedId(
      await askAgent(page, {
        op: 'worklog.add',
        issueKey: row?.issueKey,
        description: 'Review follow-ups',
        fromMs: row?.fromMs,
        durationMs: 900_000,
        client: 'Claude Code',
      }),
    );

    const chip = bandChip(page, 'worklog.add');

    await expect(chip).toContainText(`Claude Code · +15m on ${row?.issueKey ?? ''}`);
    await expect(pill(page)).toBeHidden();

    await page.locator('[data-kind="row"][data-pending]').first().click();

    const section = editSurface(page).locator('[data-row-approval]');

    await expect(section).toContainText(/Span\s*\d\d:\d\d [AP]M – \d\d:\d\d [AP]M/);
    await expect(section).toContainText('Review follow-ups');
  });
});
