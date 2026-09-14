import { Page } from '@playwright/test';
import {
  FakeBackend,
  TIMETRACK_E2E_BACKEND_KEY,
  TIMETRACK_E2E_SEED_KEY,
  TIMETRACK_E2E_TRAY_KEY,
  TimetrackWorldSeed,
} from '@ethlete/timetrack/testing';

export type TimetrackWorld = TimetrackWorldSeed & {
  /**
   * Frozen with `page.clock`, so every `new Date()` in the page reads it — the app itself has no
   * clock port. Time does not advance: a spec that needs it to must install its own clock.
   */
  now?: Date | string;
};

/**
 * Declares the world one spec needs, before the app boots.
 *
 * Call it before `page.goto`. Everything it does not name falls back to the default fixture in
 * `@ethlete/timetrack/testing`, so a spec states only what it is about.
 */
export const seedWorld = async (page: Page, world: TimetrackWorld = {}) => {
  const { now, ...seed } = world;

  if (now !== undefined) {
    // `setFixedTime` cannot be used here: RxJS 7's `debounceTime` reschedules while
    // `scheduler.now()` has not passed its target, so a frozen clock means a debounced search never
    // fires at all. `install` plus `resume` shifts the clock and lets it tick from there.
    await page.clock.install({ time: now });
    await page.clock.resume();
  }

  const raw = JSON.stringify(seed);

  await page.addInitScript(
    ([key, value]) => {
      (globalThis as Record<string, unknown>)[key as string] = value;
    },
    [TIMETRACK_E2E_SEED_KEY, raw],
  );
};

/**
 * A snapshot of the fake backend, read at the wire. This is how a flow that writes is asserted: what
 * the screen says is a second, weaker check.
 */
export const readBackend = (page: Page): Promise<FakeBackend> =>
  page.evaluate((key) => (globalThis as Record<string, unknown>)[key] as FakeBackend, TIMETRACK_E2E_BACKEND_KEY);

/** The tray menu's four lines, as the app words them. Declared here: the type lives in the app. */
export type TrayLines = { activity: string; total: string; timer: string; pause: string };

/** What the tray menu last said about today. A browser tab has no tray, so the fake port keeps it. */
export const readTray = (page: Page): Promise<TrayLines | undefined> =>
  page.evaluate((key) => (globalThis as Record<string, unknown>)[key] as TrayLines | undefined, TIMETRACK_E2E_TRAY_KEY);
