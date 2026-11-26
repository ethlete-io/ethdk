import { CollectedEvent } from '@ethlete/timetrack';
import { FakePairedMachine, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, openBand, seedWorld, test } from './support';

/** A checkout an agent worked in alone. Nothing ever brought one of its windows to the front. */
const SDK = '/Users/e2e/dev/ethlete-sdk';

/** The standing answer the user gave for that checkout, which the ladder reads at its repository rung. */
const NAMES_THE_REPO = {
  id: 'rule-sdk',
  repoPath: SDK,
  target: { kind: 'issue' as const, issueKey: 'ABC-4040' },
  author: 'user' as const,
  createdAt: new Date(0),
};

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const session = (minutes: number): CollectedEvent => ({
  at: at(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-sdk',
  cwd: SDK,
  gitBranch: 'next',
  title: 'A run nobody watched',
});

const band = (page: import('@playwright/test').Page, title: string) =>
  page.locator(`[data-kind="row"][title^="${title}"]`);

test.describe('a band an agent worked alone, in a checkout a rule names', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: { extraRepos: [SDK] },
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_REPO] },
      events: Array.from({ length: 13 }, (_, step) => session(step * 5)),
    });
    await page.goto('/day');
  });

  test('says who was not there and what ran', async ({ page }) => {
    await expect(band(page, 'Nobody was here · ABC-4040')).toHaveCount(1);
  });

  test('offers the key the day withheld, and one press books it', async ({ page }) => {
    const title = await band(page, 'Nobody was here · ABC-4040').getAttribute('title');

    await openBand(page, title as string);
    await editSurface(page).getByRole('button', { name: 'Book it as ABC-4040' }).click();

    await expect(band(page, 'ABC-4040')).toHaveCount(1);
    await expect(band(page, 'Nobody was here')).toHaveCount(0);
  });
});

const MACBOOK: FakePairedMachine = {
  machineId: 'mac-1',
  label: 'MacBook',
  certFingerprint: 'fp-mac',
  lastAddr: '192.168.1.20:52741',
  lastSeenMs: new Date(E2E_NOW).getTime() - 30_000,
  clockOffsetMs: 0,
  pairedAtMs: new Date(E2E_NOW).getTime() - 86_400_000,
  lastPullMs: null,
};

const focus = (minutes: number, title: string): CollectedEvent => ({
  at: at(minutes),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title,
});

test.describe('a run left behind here while the user moved to the paired MacBook', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: { extraRepos: [SDK] },
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_REPO] },
      events: [
        ...[0, 5, 10].map((minutes) => focus(minutes, 'session.ts - ethlete-sdk - Visual Studio Code')),
        { at: at(11), source: 'idle', kind: 'idle-start' },
        ...[15, 30, 45, 60, 75].map(session),
        { at: at(90), source: 'idle', kind: 'idle-end' },
        ...[90, 95, 100].map((minutes) => focus(minutes, 'session.ts - ethlete-sdk - Visual Studio Code')),
      ],
      peers: {
        paired: [MACBOOK],
        received: Array.from({ length: 16 }, (_, step) => ({
          machineId: MACBOOK.machineId,
          event: focus(12 + step * 5, 'notes.md - side-project - Visual Studio Code'),
        })),
      },
    });
    await page.goto('/day');
  });

  test('books the run, since the user was away from neither machine', async ({ page }) => {
    await expect(band(page, 'ABC-4040')).not.toHaveCount(0);
    await expect(band(page, 'Worked on MacBook')).toHaveCount(0);
    await expect(band(page, 'Nobody was here')).toHaveCount(0);
  });
});
