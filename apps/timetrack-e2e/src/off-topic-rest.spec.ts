import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, editSurface, expect, saveSurface, seedWorld, test } from './support';

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T16:00:00.000Z`).getTime() + minutes * 60_000);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** A call that runs on while the user works in the browser from 16:46. */
const CALL_THEN_BROWSER: CollectedEvent[] = [
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Meeting #1 | Braune Digital - Discord' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(46), source: 'window', kind: 'window-focus', appId: 'org.mozilla.firefox', title: 'Pull requests' },
];

const settings = () => {
  const base = defaultSettings();

  return {
    ...base,
    callRules: { countsAsWork: ['Discord'], neverCountsAsWork: [] },
    nudge: { ...base.nudge, enabled: false },
    reasoning: { ...base.reasoning, autoMode: true },
  };
};

const bands = (page: Page) => page.locator('[data-lane] [data-kind="row"]');
const hideChip = (page: Page) => page.locator('[data-band-approval][data-op="autoMode.hide"]');

/** The keyboard, not a click: the band redraws while the day polls. */
const nameTheCall = async (page: Page) => {
  await bands(page).first().click();
  await expect(editSurface(page)).toBeVisible();
  await editSurface(page).locator('ethlete-issue-select et-select').click();
  await page.getByRole('option', { name: /ABC-2000/ }).waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await saveSurface(page);
  await expect(bands(page).first()).toHaveAttribute('title', /^ABC-2000 · /);
};

test.describe('the rest of a call that went off topic', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: at(60),
      events: CALL_THEN_BROWSER,
      settings: settings(),
      callSource: { kind: 'linux-pipewire', watchingSinceMs: at(-60).getTime() },
    });
    await page.goto('/day');
    await nameTheCall(page);
    await page.getByRole('button', { name: 'End here', exact: true }).click();
    await expect(bands(page)).toHaveCount(2);
  });

  test('is suggested for hiding once it runs half an hour, and hidden on approve', async ({ page }) => {
    await expect(hideChip(page)).toHaveCount(0);

    await page.clock.runFor(30 * 60_000);

    await expect(hideChip(page)).toContainText('Auto · Hide, off topic');
    await expect(bands(page).last()).toHaveAttribute('data-pending');

    await hideChip(page)
      .getByRole('button', { name: /^Approve:/ })
      .click();

    await expect(hideChip(page)).toHaveCount(0);
    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page).first()).toHaveAttribute('title', /^ABC-2000 · 45m$/);
  });

  test('is never suggested again once rejected', async ({ page }) => {
    await page.clock.runFor(30 * 60_000);
    await hideChip(page)
      .getByRole('button', { name: /^Reject:/ })
      .click();
    await expect(hideChip(page)).toHaveCount(0);

    await page.clock.runFor(30 * 60_000);

    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 1h 15m$/);
    await expect(hideChip(page)).toHaveCount(0);
    await expect(bands(page)).toHaveCount(2);
  });
});
