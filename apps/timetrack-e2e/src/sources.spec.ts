import { Page } from '@playwright/test';
import { E2E_NOW, expect, seedWorld, test } from './support';

const row = (page: Page, id: string) => page.locator(`[data-source="${id}"]`);

const capability = (page: Page, reads: string) => row(page, 'window').locator(`[data-capability="${reads}"]`);

/** What a wlr compositor answers: the application and the title, and no working directory at all. */
const WAYLAND_WLR = {
  kind: 'wayland-wlr',
  detail: null,
  capabilities: [
    { reads: 'app-id', available: true, detail: null },
    { reads: 'title', available: true, detail: null },
    {
      reads: 'working-directory',
      available: false,
      detail: 'The wlr toplevel protocol reports an application id, a title and a state, and no process id.',
    },
  ],
};

/**
 * The inventory's states are the app's claim about what reaches the database, so a badge that reads
 * `collecting` for a source the host is not watching is the one wrong answer this screen can give.
 * The fake host watches no window and no microphone, which is the shape a platform with no
 * implementation of either has.
 */
test.describe('the sources screen', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/sources');
  });

  test('says a source the host is not watching is not running', async ({ page }) => {
    await expect(row(page, 'call')).toContainText('not running');
    await expect(row(page, 'call')).not.toContainText('collecting');
  });

  test('says it of every source the host reports none for, not only the call source', async ({ page }) => {
    await expect(row(page, 'window')).toContainText('not running');
    await expect(row(page, 'vscode')).toContainText('not running');
  });

  test('leaves a source the host reports no status for collecting', async ({ page }) => {
    await expect(row(page, 'git')).toContainText('collecting');
  });

  test('still reads as planned for a source nobody built', async ({ page }) => {
    await expect(row(page, 'gmail')).toContainText('planned');
  });
});

/**
 * A folded "Other applications" line is either a defect or a capability this machine does not have,
 * and only the source itself can say which. Without this the two read the same.
 */
test.describe('what the focused-window source reads on this machine', () => {
  test('names the working directory as unread, and why', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, windowSource: WAYLAND_WLR });
    await page.goto('/sources');

    await expect(capability(page, 'working-directory')).toContainText('does not read');
    await expect(capability(page, 'working-directory')).toContainText('The directory the focused window works in');
    await expect(capability(page, 'working-directory')).toContainText('no process id');
  });

  test('names what it does read, so the list is not a list of faults', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, windowSource: WAYLAND_WLR });
    await page.goto('/sources');

    await expect(capability(page, 'title')).toContainText('reads');
    await expect(capability(page, 'title')).not.toContainText('does not read');
    await expect(capability(page, 'app-id')).not.toContainText('does not read');
  });

  test('says the title is unread while macOS withholds the permission', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      windowSource: {
        kind: 'macos-app-only',
        detail: null,
        capabilities: [
          { reads: 'app-id', available: true, detail: null },
          { reads: 'title', available: false, detail: 'Timetrack has no Accessibility permission.' },
          { reads: 'working-directory', available: false, detail: "No source reads a window's working directory yet." },
        ],
      },
    });
    await page.goto('/sources');

    await expect(capability(page, 'title')).toContainText('does not read');
    await expect(capability(page, 'title')).toContainText('Accessibility permission');
  });

  test('claims nothing at all while no source is watching', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/sources');

    await expect(row(page, 'window')).toContainText('not running');
    await expect(row(page, 'window')).not.toContainText('What it reads on this machine');
  });

  test('never claims it of the presence row, which shares the same collector', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, windowSource: WAYLAND_WLR });
    await page.goto('/sources');

    await expect(row(page, 'idle')).not.toContainText('What it reads on this machine');
  });
});
