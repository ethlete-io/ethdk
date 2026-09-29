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

const PX_PER_MINUTE = 80 / 60;
const PIECE_GAP_PX = 2;

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

const expectFullWidthInTurn = async (page: Page) => {
  const { laneBox, drawn } = await drawnPieces(page);

  for (const piece of drawn) {
    expect(piece.box.width).toBeGreaterThan(laneBox.width - 2);
    expect(piece.clipPath).toBe('none');
    expect(piece.text).toContain('XYZ-4200');
  }

  const byTop = drawn.map((piece) => piece.box).sort((a, b) => a.y - b.y);

  byTop.slice(1).forEach((box, index) => {
    const above = byTop[index];

    expect(box.y).toBeGreaterThanOrEqual((above?.y ?? 0) + (above?.height ?? 0) + PIECE_GAP_PX - 1);
  });
};

test.describe('parallel sessions on one ticket, prompted in turn', () => {
  test.beforeEach(async ({ page }) => {
    await seedDay(page, { prompts: [0, 30, 60], end: 90 });
  });

  test('take turns in the lane at full width, each drawn only as tall as it books', async ({ page }) => {
    const { drawn, titles } = await drawnPieces(page);

    expect(titles).toHaveLength(2);
    expect(drawn.length).toBeGreaterThan(titles.length);
    await expectFullWidthInTurn(page);

    for (const title of titles) {
      const height = drawn
        .filter((piece) => piece.title === title)
        .reduce((sum, piece) => sum + piece.box.height + PIECE_GAP_PX, 0);

      expect(height).toBeCloseTo(minutesOf(title) * PX_PER_MINUTE, 0);
    }
  });

  test('open the same row from any of its pieces', async ({ page }) => {
    const { drawn, titles } = await drawnPieces(page);
    const split = titles.find((title) => drawn.filter((piece) => piece.title === title).length > 1) ?? '';
    const other = titles.find((title) => title !== split) ?? '';
    const pieces = page.locator(`[data-lane] [data-kind="row"][title="${split}"]`);
    const surfaceOf = async (band: Locator) => {
      await band.click();
      await expect(editSurface(page)).toBeVisible();

      const text = await editSurface(page).innerText();

      await editSurface(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(editSurface(page)).toBeHidden();

      return text;
    };

    const fromFirst = await surfaceOf(pieces.first());

    expect(await surfaceOf(pieces.last())).toBe(fromFirst);
    expect(await surfaceOf(page.locator(`[data-lane] [data-kind="row"][title="${other}"]`))).not.toBe(fromFirst);
  });
});

test.describe('parallel sessions on one ticket that each round up past the clock', () => {
  test('book the clock once and take turns in the lane at full width', async ({ page }) => {
    await seedDay(page, { prompts: [0, 20, 40], end: 60 });

    const { titles } = await drawnPieces(page);

    expect(titles.reduce((sum, title) => sum + minutesOf(title), 0)).toBeLessThanOrEqual(60);
    await expectFullWidthInTurn(page);
  });
});
