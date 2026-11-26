import { Locator, Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, pickIssue, saveSurface, seedWorld, test } from './support';

/** The seeded day's afternoon, in the browser's pinned UTC. */
const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** Three hours in a voice room. No call rule counts it as work, so the day draws it as excluded. */
const EVENTS: CollectedEvent[] = [
  { at: at('14:00'), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Open Room #1 | Braune Digital' },
  { at: at('14:01'), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at('17:00'), source: 'call', kind: 'call-end', appId: HELPER },
];

const settings = () => ({ ...defaultSettings(), nudge: { ...defaultSettings().nudge, enabled: false } });

const excludedBands = (page: Page) => page.locator('[data-kind="row"][title^="Not counted"]');

const namedBand = (page: Page) => page.locator('[data-kind="row"][title^="ABC-2000"]');

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('the element is not rendered');

  return box;
};

/** Draws down the band from one fraction of its height to another, which is the gesture under test. */
const drawOn = async (options: { page: Page; band: Locator; from: number; to: number }) => {
  const { page, band } = options;
  const box = await boxOf(band);
  const x = box.x + box.width / 2;

  await page.mouse.move(x, box.y + box.height * options.from);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * options.to, { steps: 10 });
  await page.mouse.up();
};

test.describe('a band a rule excluded', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings() });
    await page.goto('/day');
    await expect(excludedBands(page)).toHaveCount(1);
  });

  test('cuts the minutes a row drawn over it covers out of itself', async ({ page }) => {
    await drawOn({ page, band: excludedBands(page).first(), from: 1 / 3, to: 2 / 3 });

    const surface = editSurface(page);

    await expect(surface).toBeVisible();
    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);

    await expect(namedBand(page)).toHaveCount(1);
    await expect(excludedBands(page)).toHaveCount(2);
  });

  test('draws a range rather than resizing when the drag starts on its end', async ({ page }) => {
    const band = excludedBands(page).first();
    const before = await band.getAttribute('title');

    await drawOn({ page, band, from: 0.98, to: 1.3 });

    await expect(editSurface(page)).toBeVisible();
    await expect(excludedBands(page).first()).toHaveAttribute('title', before ?? '');
  });

  test('still opens its own edit surface when it is only clicked', async ({ page }) => {
    await excludedBands(page).first().click();

    await expect(editSurface(page)).toBeVisible();
    await expect(editSurface(page)).toContainText('Open Room #1');
  });
});
