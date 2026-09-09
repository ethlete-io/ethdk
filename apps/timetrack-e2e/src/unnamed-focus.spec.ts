import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The checkout the fake git backend discovers, so a window title naming it resolves. */
const FUT = '/Users/e2e/dev/fut-frontend';

/** A checkout the user keeps out of the day. Its window time is unnamed, and that is correct. */
const SECRET = '/Users/e2e/dev/umbau-elrond';

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const focus = (minutes: number, appId: string, title: string): CollectedEvent => ({
  at: at(minutes),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

/**
 * Ninety minutes of focus, of which forty-five named a checkout: three quarters of an hour in an
 * editor on `FUT`, half an hour in a terminal, and a quarter of an hour in a music player.
 *
 * A stretch belongs to the sample that opens it, so the last sample closes nothing and the day holds
 * ninety minutes of focus rather than a hundred and five.
 */
const day = (): CollectedEvent[] => [
  { at: at(0), source: 'git', kind: 'git-checkout', repoPath: FUT, branch: 'next' },
  ...[0, 15, 30].map((minutes) => focus(minutes, 'code', 'invite.ts - fut-frontend - Visual Studio Code')),
  ...[45, 60].map((minutes) => focus(minutes, 'foot', 'tom@e2e: ~')),
  ...[75, 90].map((minutes) => focus(minutes, 'spotify', 'Spotify')),
];

const total = (page: Page) => page.locator('[data-unnamed-total]');

const gap = (page: Page) => page.locator('[data-unnamed-gap]');

const unknown = (page: Page) => page.locator('[data-unnamed-unknown]');

const row = (page: Page, app: string) => page.locator(`[data-app="${app}"]`);

/**
 * The panel that measures what the Other applications line is made of.
 *
 * It is the step every rung of the naming plan is judged by, so the one thing it may never do is
 * disagree with the Today screen about how many minutes went unnamed.
 */
test.describe('the focus that named no checkout', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: day() });
    await page.goto('/sources');
  });

  test('says how much of the focused time named no checkout', async ({ page }) => {
    await expect(total(page)).toContainText('45m of 1h 30m');
    await expect(total(page)).toContainText('50%');
  });

  test('names every application the folded line is made of', async ({ page }) => {
    await expect(row(page, 'foot')).toContainText('30m');
    await expect(row(page, 'foot')).toContainText('no checkout in the title');
    await expect(row(page, 'spotify')).toContainText('15m');
  });

  test('names no application a checkout took the whole time of', async ({ page }) => {
    await expect(row(page, 'code')).toHaveCount(0);
  });

  test('calls no time a gap when no application that names checkouts lost any', async ({ page }) => {
    await expect(gap(page)).toContainText('No application that names checkouts lost any of it.');
    await expect(unknown(page)).toContainText('45m of it is an application that never named a checkout');
  });

  test('calls it a gap when the application that lost the time names checkouts elsewhere', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [...day(), focus(105, 'code', 'Visual Studio Code'), focus(120, 'foot', 'tom@e2e: ~')],
    });
    await page.goto('/sources');

    await expect(row(page, 'code')).toContainText('names one elsewhere');
    await expect(gap(page)).toContainText('15m of it is a window a checkout should have taken');
  });

  test('marks an application that never named a checkout as one that never does', async ({ page }) => {
    await expect(row(page, 'spotify')).toContainText('never names one');
    await expect(row(page, 'foot')).toContainText('never names one');
  });

  test('drops a window that held the focus for less than a rounded minute', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [...day(), focus(91, 'gnome-ssh-askpass', 'ssh'), focus(91.25, 'foot', 'tom@e2e: ~')],
    });
    await page.goto('/sources');

    await expect(row(page, 'spotify')).toContainText('16m');
    await expect(row(page, 'gnome-ssh-askpass')).toHaveCount(0);
  });

  test('says the unnamed time was all slivers, rather than that every window named a checkout', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        { at: at(0), source: 'git', kind: 'git-checkout', repoPath: FUT, branch: 'next' },
        focus(0, 'code', 'invite.ts - fut-frontend - Visual Studio Code'),
        focus(30, 'gnome-ssh-askpass', 'ssh'),
        focus(30.25, 'code', 'invite.ts - fut-frontend - Visual Studio Code'),
        focus(60, 'code', 'invite.ts - fut-frontend - Visual Studio Code'),
      ],
    });
    await page.goto('/sources');

    await expect(page.getByText('held it for under a minute')).toBeVisible();
  });

  test('reads the last fourteen days as well as today, and says which it is showing', async ({ page }) => {
    await page.locator('[data-span="span"]').click();

    await expect(total(page)).toContainText('Last 14 days');
    await expect(total(page)).toContainText('45m of 1h 30m');
  });

  test('marks a window on a private project as unnamed on purpose, not as a defect', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        ...day(),
        focus(105, 'code', 'plan.md - umbau-elrond - Visual Studio Code'),
        focus(120, 'foot', 'tom@e2e: ~'),
      ],
      settings: {
        ...defaultSettings(),
        projectLinks: [{ id: 'link-secret', path: SECRET, target: { kind: 'private' }, createdAt: new Date(0) }],
      },
    });
    await page.goto('/sources');

    await expect(row(page, 'code')).toContainText('a private project');
    await expect(row(page, 'code')).toContainText('on purpose');
    await expect(row(page, 'code')).toContainText('15m');
    await expect(unknown(page)).toContainText('1h 0m of it is an application that never named a checkout');
  });

  test('says no window held the focus, rather than showing an empty list', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [] });
    await page.goto('/sources');

    await expect(total(page)).toContainText('no window held the focus');
  });
});
