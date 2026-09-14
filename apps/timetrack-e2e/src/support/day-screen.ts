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
 * Opens the debug panel that holds the work still waiting for a name.
 *
 * Everything about naming a context — the suggestions, the ticket draft and the branch repair after
 * it — is inside this one panel.
 */
export const openWaitingForAName = (page: Page) => openDebugPanel(page, /^Waiting for a name/);

/** The panel holding the day's notes: its calls, what the collectors could not read, and the free text. */
export const openDayNotes = (page: Page) => openDebugPanel(page, 'Day notes');

/** The dialog behind the day header's Debug button, which every readout and every naming panel lives in. */
export const openDebug = async (page: Page) => {
  const dialog = page.locator('ethlete-day-debug');

  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    await expect(dialog).toBeVisible();
  }

  return dialog;
};

/**
 * Dismisses the debug dialog. It is modal, so a spec that reads a debug panel and then acts on the
 * day screen behind it has to close it first.
 */
export const closeDebug = async (page: Page) => {
  const dialog = page.locator('ethlete-day-debug');

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
};

/** What the day totalled: presence, engaged time and the ratio between them. */
export const openTotals = (page: Page) => openDebugPanel(page, 'What was measured');

/** The evidence under the day's bands: one line per checkout. */
export const openStreams = (page: Page) => openDebugPanel(page, /^Streams —/);

/** The panel holding the time this app will never write. */
export const openLoggedElsewhere = (page: Page) => openDebugPanel(page, /^Logged elsewhere —/);

/** The panel holding the rows taken off the timeline, and the way back for each. */
export const openHiddenRows = (page: Page) => openDebugPanel(page, /^Hidden —/);

/** The header of the debug panel with the given label, which carries that panel's own counts. */
export const debugPanelLabel = (page: Page, label: string | RegExp) =>
  page.locator('ethlete-day-debug').getByRole('button', { name: label });

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

const openDebugPanel = async (page: Page, label: string | RegExp) => {
  const dialog = await openDebug(page);
  const trigger = dialog.getByRole('button', { name: label });

  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();

  // `has` is matched inside each candidate, so the trigger has to be named from the page root.
  const accordion = dialog.locator('et-accordion').filter({ has: page.getByRole('button', { name: label }) });

  return accordion.locator('> .et-accordion-panel');
};
