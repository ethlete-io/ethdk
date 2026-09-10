import { Locator, Page, expect } from '@playwright/test';

/** The scheduler's edit surface, which is where every band is named, timed and answered. */
export const editSurface = (page: Page) => page.locator('et-scheduler-edit-surface');

/**
 * Opens the edit surface for a band. `title` is the band's own label — the issue it is logged
 * against and how much it logs, e.g. `ABC-3010 · 1h 30m`.
 */
export const openBand = async (page: Page, title: string) => {
  await page.locator(`[data-kind="row"][title="${title}"]`).click();
  await expect(editSurface(page)).toBeVisible();

  return editSurface(page);
};

/** Opens the surface for a row nothing observed, over the hour that just finished. */
export const addAnEntry = async (page: Page) => {
  await page.getByRole('button', { name: 'Add an entry' }).click();
  await expect(editSurface(page)).toBeVisible();

  return editSurface(page);
};

/** Picks an issue in whichever issue picker the given surface holds. */
export const pickIssue = async (page: Page, within: Locator, pattern: RegExp) => {
  await within.locator('ethlete-issue-select et-select').click();
  await page.getByRole('option', { name: pattern }).click();
};

/** Saves the open surface and waits for it to go. */
export const saveSurface = async (page: Page) => {
  await editSurface(page).getByRole('button', { name: 'Save' }).click();
  await expect(editSurface(page)).toBeHidden();
};

/**
 * Opens the strip under the timeline that holds the work still waiting for a name.
 *
 * It is closed on load, because the timeline is what the screen is for. Everything about naming a
 * context — the suggestions, the ticket draft and the branch repair after it — is inside it.
 */
export const openWaitingForAName = (page: Page) => openStrip(page, 'data-waiting');

/** The same, for the evidence under the day's bands: one line per checkout. */
export const openStreams = (page: Page) => openStrip(page, 'data-streams');

/** The same, for the strip holding the time this app will never write. */
export const openLoggedElsewhere = (page: Page) => openStrip(page, 'data-logged');

/** The same, for the day's notes: its calls, what the collectors could not read, and the free text. */
export const openDayNotes = (page: Page) => openStrip(page, 'data-notes');

/** Answers the open surface's "log this time" question, which is what decides whether a sync writes. */
export const setLogged = async (page: Page, logged: boolean) => {
  const box = editSurface(page).getByRole('checkbox');

  if (logged) await box.check();
  else await box.uncheck();
};

/**
 * Accepts the seeded morning, which is what a sync writes. It is the fixture's one named band, and
 * every write test starts from it.
 */
export const logTheNamedRow = async (page: Page) => {
  await openBand(page, 'ABC-3010 · 1h 30m');
  await setLogged(page, true);
  await saveSurface(page);
};

const openStrip = async (page: Page, marker: string) => {
  const strip = page.locator(`details[${marker}]`);

  if (!(await strip.evaluate((element: HTMLDetailsElement) => element.open))) {
    await strip.locator('> summary').click();
  }

  return strip;
};
