import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const SLACK = 'com.slack.Slack';

const EVENTS: CollectedEvent[] = [
  { at: at('14:00'), source: 'window', kind: 'window-focus', appId: SLACK, title: 'Huddle' },
  { at: at('14:00'), source: 'call', kind: 'call-start', appId: SLACK },
  { at: at('14:30'), source: 'call', kind: 'call-end', appId: SLACK },
];

const settings = (neverCountsAsWork: string[] = []) => ({
  ...defaultSettings(),
  nudge: { ...defaultSettings().nudge, enabled: false },
  callRules: { countsAsWork: ['google-chrome', 'Discord'], neverCountsAsWork },
});

const excludedBands = (page: Page) => page.locator('[data-kind="row"][title^="Not counted"]');

test.describe('a call no rule counts', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings() });
    await page.goto('/day');
  });

  test('says on its band why it is not counted', async ({ page }) => {
    await expect(excludedBands(page)).toHaveCount(1);
    await expect(excludedBands(page)).toHaveAttribute('title', /^Not counted · Slack, no rule counts it as work/);
  });

  test('counts once its application is counted as work from the band menu', async ({ page }) => {
    await excludedBands(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Count Slack as work' }).click();

    await expect(excludedBands(page)).toHaveCount(0);
    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).toHaveCount(1);
  });
});

test('a call a rule excludes says so and offers no count', async ({ page }) => {
  await seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings(['Huddle']) });
  await page.goto('/day');

  await expect(excludedBands(page)).toHaveAttribute('title', /^Not counted · Slack, a rule excludes it/);

  await excludedBands(page).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Split in half' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /as work/ })).toBeHidden();
});
