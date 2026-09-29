import { Locator, Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { FakeJiraIssue, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, seedWorld, test } from './support';

const SDK = '/Users/e2e/dev/ethlete-sdk';

const XYZ = { key: 'XYZ', name: 'Beta' };

const ISSUES: FakeJiraIssue[] = [
  {
    id: '10400',
    key: 'XYZ-4200',
    summary: 'The shared library',
    issueType: 'Task',
    updated: `${E2E_DAY_KEY}T08:00:00.000Z`,
  },
];

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const steps = (from: number, to: number) =>
  Array.from({ length: Math.floor((to - from) / 5) + 1 }, (_, step) => from + step * 5);

const session = (options: { sessionId: string; minutes: number; workedIn: string }): CollectedEvent => ({
  at: at(options.minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: options.sessionId,
  cwd: SDK,
  gitBranch: 'next',
  workedIn: `${SDK}/${options.workedIn}`,
});

const prompt = (options: { sessionId: string; minutes: number }): CollectedEvent => ({
  at: at(options.minutes),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: options.sessionId,
  promptId: `${options.sessionId}-${options.minutes}`,
  cwd: SDK,
});

/** Two agent sessions in two directories of one checkout, prompted in turn, both named by one rule. */
const day = (options: { prompts: readonly number[]; end: number }): CollectedEvent[] => [
  ...steps(0, options.end).flatMap((minutes) => [
    session({ sessionId: 'one', minutes, workedIn: 'libs/a/a.ts' }),
    session({ sessionId: 'two', minutes, workedIn: 'libs/b/b.ts' }),
  ]),
  ...steps(0, options.end).map((minutes): CollectedEvent => ({
    at: at(minutes),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'a.ts - ethlete-sdk - Visual Studio Code',
  })),
  ...options.prompts.map((minutes, turn) => prompt({ sessionId: turn % 2 ? 'two' : 'one', minutes })),
  { at: at(options.end), source: 'idle', kind: 'idle-start' },
];

const seedDay = async (page: Page, options: { prompts: readonly number[]; end: number }) => {
  await seedWorld(page, {
    now: E2E_NOW,
    events: day(options),
    git: { extraRepos: [SDK] },
    jira: { issues: ISSUES, projects: [XYZ] },
    settings: {
      ...defaultSettings(),
      favoriteProjects: [XYZ],
      attributionRules: [
        {
          id: 'rule-sdk',
          repoPath: SDK,
          target: { kind: 'issue' as const, issueKey: 'XYZ-4200' },
          author: 'user' as const,
          createdAt: new Date(0),
        },
      ],
    },
  });
  await page.goto('/day');
};

const boxOf = async (locator: Locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

const minutesOf = (title: string) => {
  const [, hours, minutes] = /· (?:(\d+)h )?(\d+)m$/.exec(title) ?? [];

  return Number(hours ?? 0) * 60 + Number(minutes ?? 0);
};

const drawnPieces = async (page: Page) => {
  const lane = page.locator('[data-lane]').filter({ has: page.locator('[title^="XYZ-4200"]') });
  const pieces = lane.locator('[data-kind="row"]');

  await expect(pieces).not.toHaveCount(0);

  const laneBox = await boxOf(lane);
  const drawn = await Promise.all(
    (await pieces.all()).map(async (piece) => ({
      title: (await piece.getAttribute('title')) ?? '',
      box: await boxOf(piece),
      text: await piece.innerText(),
      clipPath: await piece.evaluate((element) => getComputedStyle(element).clipPath),
    })),
  );

  return { laneBox, drawn, titles: [...new Set(drawn.map((piece) => piece.title))] };
};

const expectInSequence = (
  laneBox: { height: number },
  drawn: readonly { title: string; box: { y: number; height: number } }[],
) => {
  const pxPerMinute = laneBox.height / (24 * 60);

  for (const piece of drawn) expect(piece.box.height).toBeCloseTo(minutesOf(piece.title) * pxPerMinute, 0);

  const byTop = drawn.map((piece) => piece.box).sort((a, b) => a.y - b.y);

  byTop.slice(1).forEach((box, index) => {
    const above = byTop[index];

    expect(box.y).toBeGreaterThanOrEqual((above?.y ?? 0) + (above?.height ?? 0) - 1);
  });
};

const surfaceOf = async (page: Page, band: Locator) => {
  await band.click({ position: { x: 8, y: 8 } });
  await expect(editSurface(page)).toBeVisible();

  const text = await editSurface(page).innerText();

  await editSurface(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(editSurface(page)).toBeHidden();

  return text;
};

const bandsOf = (page: Page, title: string) => page.locator(`[data-lane] [data-kind="row"][title="${title}"]`);

test.describe('parallel sessions on one ticket, prompted in turn', () => {
  test.beforeEach(async ({ page }) => {
    await seedDay(page, { prompts: [0, 30, 60], end: 90 });
  });

  test('follow each other at full width, one card per session', async ({ page }) => {
    const { laneBox, drawn, titles } = await drawnPieces(page);

    expect(titles).toHaveLength(2);
    expect(drawn).toHaveLength(titles.length);

    for (const piece of drawn) {
      expect(piece.box.width).toBeGreaterThan(laneBox.width - 2);
      expect(piece.clipPath).toBe('none');
    }

    expectInSequence(laneBox, drawn);
  });
});

test.describe('parallel sessions on one ticket that each round up past the clock', () => {
  test.beforeEach(async ({ page }) => {
    await seedDay(page, { prompts: [0, 20, 40], end: 60 });
  });

  test('book the clock once, one card after the other', async ({ page }) => {
    const { laneBox, drawn, titles } = await drawnPieces(page);

    expect(titles.reduce((sum, title) => sum + minutesOf(title), 0)).toBeLessThanOrEqual(60);
    expectInSequence(laneBox, drawn);
  });

  test('open each card with the duration its band books', async ({ page }) => {
    for (const title of (await drawnPieces(page)).titles) {
      await bandsOf(page, title)
        .first()
        .click({ position: { x: 8, y: 8 } });

      const logged = await editSurface(page).getByLabel('Time this band logs').locator('input').inputValue();
      const [hours = 0, minutes = 0] = logged.split(':').map(Number);

      expect(hours * 60 + minutes).toBe(minutesOf(title));

      await editSurface(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(editSurface(page)).toBeHidden();
    }
  });

  test('open a different row from each card', async ({ page }) => {
    const [first = '', second = ''] = (await drawnPieces(page)).titles;

    expect(await surfaceOf(page, bandsOf(page, first).first())).not.toBe(
      await surfaceOf(page, bandsOf(page, second).first()),
    );
  });
});
