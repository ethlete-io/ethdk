import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const SLACK = 'com.slack.Slack';

const ZOOM = 'us.zoom.Zoom';

const callIn = (appId: string): CollectedEvent[] => [
  { at: at('14:00'), source: 'window', kind: 'window-focus', appId, title: 'Huddle' },
  { at: at('14:00'), source: 'call', kind: 'call-start', appId },
  { at: at('14:30'), source: 'call', kind: 'call-end', appId },
];

const settings = (neverCountsAsWork: string[] = []) => ({
  ...defaultSettings(),
  nudge: { ...defaultSettings().nudge, enabled: false },
  callRules: { countsAsWork: ['google-chrome', 'Discord'], neverCountsAsWork },
});

const excludedBands = (page: Page) => page.locator('[data-kind="row"][title^="Not counted"]');

test.describe('a call no rule counts', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: callIn(ZOOM), settings: settings() });
    await page.goto('/day');
  });

  test('says on its band why it is not counted', async ({ page }) => {
    await expect(excludedBands(page)).toHaveCount(1);
    await expect(excludedBands(page)).toHaveAttribute('title', /^Not counted · Zoom, no rule counts it as work/);
  });

  test('counts once its application is counted as work from the band menu', async ({ page }) => {
    await excludedBands(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Count Zoom as work' }).click();

    await expect(excludedBands(page)).toHaveCount(0);
    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).toHaveCount(1);
  });
});

test('a Slack huddle counts though no rule names Slack', async ({ page }) => {
  await seedWorld(page, { now: E2E_NOW, events: callIn(SLACK), settings: settings() });
  await page.goto('/day');

  await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).toHaveCount(1);
  await expect(excludedBands(page)).toHaveCount(0);
});

test('a call a rule excludes says so and offers no count', async ({ page }) => {
  await seedWorld(page, { now: E2E_NOW, events: callIn(SLACK), settings: settings(['Huddle']) });
  await page.goto('/day');

  await expect(excludedBands(page)).toHaveAttribute('title', /^Not counted · Slack, a rule excludes it/);

  await excludedBands(page).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Split in half' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /as work/ })).toBeHidden();
});

test.describe('a call the user talked in from another window', () => {
  const DISCORD = 'com.hnc.Discord';
  const events: CollectedEvent[] = [
    { at: at('14:00'), source: 'window', kind: 'window-focus', appId: 'code', title: 'calls.ts - Code' },
    { at: at('14:01'), source: 'call', kind: 'call-start', appId: DISCORD },
    { at: at('14:20'), source: 'call', kind: 'call-end', appId: DISCORD },
  ];
  const chunk = (clock: string) => ({
    atMs: at(clock).getTime(),
    callStartedAtMs: at('14:01').getTime(),
    appId: DISCORD,
    model: 'm',
    language: 'de',
    text: 'Wir verschieben den Release.',
  });

  test('is never in front when nothing was heard', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events, settings: settings() });
    await page.goto('/day');

    await expect(excludedBands(page)).toHaveAttribute('title', /^Not counted · Discord, never in front/);
  });

  test('counts once the transcriber heard it', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events,
      settings: settings(),
      transcription: { chunks: [chunk('14:05'), chunk('14:12')] },
    });
    await page.goto('/day');

    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).toHaveCount(1);
    await expect(excludedBands(page)).toHaveCount(0);
  });
});
