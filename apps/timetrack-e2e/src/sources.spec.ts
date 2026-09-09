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

/**
 * A shell-out source holds no token in this app's keychain, so nothing here can go stale the way a
 * personal access token does. What can go away instead is the binary and the login, and those are two
 * different repairs. A row that reported them as one would trade a visible expiry for a silent one.
 */
test.describe('the GitLab row, which reads through `glab`', () => {
  test('reads the instance through the CLI and stores what it found', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      gitlab: {
        // The event names the merge request and not its branch, so the run only stays free of a
        // warning if the second call — the lookup by iid — went through the CLI as well.
        events: [
          {
            id: '5001',
            at: '2026-08-12T09:00:00.000Z',
            actionName: 'approved',
            projectId: 'braune-digital/fut-frontend',
            targetType: 'MergeRequest',
            targetTitle: 'Password reset',
            mergeRequestIid: '77',
          },
        ],
        mergeRequests: [
          {
            iid: '77',
            projectId: 'braune-digital/fut-frontend',
            title: 'Password reset',
            sourceBranch: 'feat/ABC-1-user-management',
            targetBranch: 'next',
            state: 'opened',
            webUrl: 'https://gitlab.example.com/braune-digital/fut-frontend/-/merge_requests/77',
          },
        ],
      },
    });
    await page.goto('/sources');

    await expect(row(page, 'gitlab')).toContainText('collecting');
    await expect(row(page, 'gitlab')).toContainText('Last read at');
    await expect(row(page, 'gitlab')).toContainText('1 stored');
    await expect(row(page, 'gitlab')).not.toContainText('merge request !77');
  });

  test('says the binary is missing, and does not call that a login problem', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, glab: { installed: false, logins: [] } });
    await page.goto('/sources');

    await expect(row(page, 'gitlab')).toContainText('not installed');
    await expect(row(page, 'gitlab')).not.toContainText('auth login');
  });

  test('names the login command when the binary is there and holds no credential', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, glab: { installed: true, logins: [] } });
    await page.goto('/sources');

    await expect(row(page, 'gitlab')).toContainText('glab auth login --hostname gitlab.example.com');
    await expect(row(page, 'gitlab')).not.toContainText('not installed');
  });

  test('asks for a login to the configured instance, not to whichever one `glab` happens to hold', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      glab: { installed: true, logins: [{ host: 'gitlab.com', login: 'somebody' }] },
    });
    await page.goto('/sources');

    await expect(row(page, 'gitlab')).toContainText('glab auth login --hostname gitlab.example.com');
  });
});
