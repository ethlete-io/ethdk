import { Page } from '@playwright/test';
import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { CollectedEvent, TimetrackSettings } from '@ethlete/timetrack';
import { E2E_DAY_KEY, E2E_NOW, askAgent, editSurface, expect, queuedId, readBackend, seedWorld, test } from './support';

const withAutoMode = (settings: TimetrackSettings): TimetrackSettings => ({
  ...settings,
  reasoning: { ...settings.reasoning, autoMode: true },
});

const bandChip = (page: Page, op: string) => page.locator(`[data-band-approval][data-op="${op}"]`);
const pill = (page: Page) => page.locator('[data-waiting-pill]');

const LINKS_THE_CHECKOUT = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

/** A quarter hour on a branch no issue names, which draws one band a single line tall. */
const A_SHORT_STRETCH: CollectedEvent[] = [
  { at: at('11:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: 'feat/pdf-export' },
  {
    at: at('11:01'),
    source: 'window',
    kind: 'window-focus',
    appId: 'com.microsoft.VSCode',
    title: 'pdf-export.ts - fut-frontend - Visual Studio Code',
  },
  {
    at: at('11:10'),
    source: 'git',
    kind: 'git-commit',
    repoPath: E2E_REPO,
    branch: 'feat/pdf-export',
    sha: 'd4e5f6a',
    subject: 'Try pdfkit',
  },
  { at: at('11:14'), source: 'idle', kind: 'idle-start' },
];

/** Whether the waiting approval drawn on a band lies over any glyph of that band's label. */
const approvalCoversLabel = (page: Page) =>
  page.locator('[data-kind="row"][data-pending]').evaluate((band) => {
    const label = band.querySelector(':scope > .truncate');
    const mark = band.parentElement?.querySelector('[data-band-approval] > *');

    if (!label || !mark) throw new Error('the band has no label or no approval mark');

    const range = document.createRange();

    range.selectNodeContents(label);

    const text = range.getBoundingClientRect();
    const right = Math.min(text.right, label.getBoundingClientRect().right);
    const box = mark.getBoundingClientRect();

    return box.left < right && box.right > text.left && box.top < text.bottom && box.bottom > text.top;
  });

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

test.describe('a create auto mode queued for a stand-in no issue tracks', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      jira: { issues: [] },
      settings: withAutoMode({ ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] }),
    });
    await page.goto('/day');
  });

  test('previews on the stand-in band and files once its chip is approved', async ({ page }) => {
    const chip = bandChip(page, 'jira.create');

    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText('Auto · File ABC');
    await expect(page.locator('[data-kind="row"][data-stand-in][data-pending]')).toHaveCount(1);
    await expect(pill(page)).toBeHidden();
    expect((await readBackend(page)).jira.created).toEqual([]);

    await chip.getByRole('button', { name: /^Approve:/ }).click();

    await expect(chip).toBeHidden();
    await expect
      .poll(async () => (await readBackend(page)).jira.created.map((issue) => issue.summary))
      .toEqual(['Drafted Pdf export']);
  });
});

test.describe('a create auto mode queued for a band one line tall', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 560, height: 800 });
    await seedWorld(page, { now: E2E_NOW, events: A_SHORT_STRETCH, settings: withAutoMode(defaultSettings()) });
    await page.goto('/day');
  });

  test('leaves the label of the band readable', async ({ page }) => {
    await expect(page.locator('[data-kind="row"][data-pending]')).toHaveCount(1);
    await expect(bandChip(page, 'jira.create')).toHaveCount(1);

    expect(await approvalCoversLabel(page)).toBe(false);
  });

  test('is approved from the edit surface of the band', async ({ page }) => {
    await page.locator('[data-kind="row"][data-pending]').click();
    await editSurface(page).locator('[data-row-approval]').getByRole('button', { name: 'Approve' }).click();

    await expect.poll(async () => (await readBackend(page)).jira.created.length).toBe(1);
    await expect(bandChip(page, 'jira.create')).toHaveCount(0);
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

test.describe('a worklog add on no row of the day', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('previews where the row would land and adds it once its chip is approved', async ({ page }) => {
    const id = queuedId(
      await askAgent(page, {
        op: 'worklog.add',
        issueKey: 'ABC-1',
        description: 'Pairing on the invoice export',
        fromMs: at('15:00').getTime(),
        durationMs: 1_800_000,
        client: 'Claude Code',
      }),
    );

    const preview = page.locator(`[data-approval-preview="${id}"]`);
    const chip = bandChip(page, 'worklog.add');

    await expect(preview).toBeVisible();
    await expect(chip).toContainText('Claude Code · +30m on ABC-1');
    await expect(pill(page)).toBeHidden();

    const [previewBox, hourBox] = await Promise.all([
      preview.boundingBox(),
      page.locator('[data-hour="15"]').boundingBox(),
    ]);

    expect(Math.abs((previewBox?.y ?? 0) - (hourBox?.y ?? 0))).toBeLessThan(2);

    await chip.getByRole('button', { name: /^Approve:/ }).click();

    await expect(preview).toBeHidden();
    await expect(page.locator('[data-kind="row"][title^="ABC-1 "]')).toHaveCount(1);
  });
});
