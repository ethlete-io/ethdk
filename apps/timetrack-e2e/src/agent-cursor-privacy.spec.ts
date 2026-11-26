import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, readStoredCursors, seedWorld, test } from './support';

const PRIVATE = '/Users/e2e/dev/side';
const WORK = '/Users/e2e/dev/fut-frontend';

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const turn = (options: { minutes: number; cwd: string; id: string }) =>
  JSON.stringify({
    type: 'assistant',
    uuid: options.id,
    timestamp: at(options.minutes).toISOString(),
    cwd: options.cwd,
    sessionId: 'session-a',
    gitBranch: 'next',
    message: {
      id: options.id,
      model: 'claude-opus-5',
      role: 'assistant',
      usage: {
        input_tokens: 100,
        output_tokens: 2_000,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens_details: { thinking_tokens: 0 },
      },
    },
  });

const titled = (title: string) => JSON.stringify({ type: 'custom-title', customTitle: title });

const logOf = (options: { cwd: string; title: string }) => [
  {
    id: 'session-a',
    path: `/Users/e2e/.claude/projects/session-a.jsonl`,
    modifiedAt: `${E2E_DAY_KEY}T12:00:00.000Z`,
    lines: [
      titled(options.title),
      turn({ minutes: 0, cwd: options.cwd, id: 'msg_0' }),
      turn({ minutes: 5, cwd: options.cwd, id: 'msg_5' }),
    ],
  },
];

const storedCursor = async (page: Parameters<typeof readStoredCursors>[0]) => {
  await expect.poll(async () => (await readStoredCursors(page))['agent-session']?.length ?? 0).toBeGreaterThan(0);

  return (await readStoredCursors(page))['agent-session']?.[0];
};

/**
 * A cursor carries the last title and the checkout of the log it points into, and it is stored beside
 * the events. These runs are what say the two filters the events go through reach it as well.
 */
test.describe('what an agent-log cursor is allowed to store', () => {
  test('keeps neither the path nor the title of a private checkout', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: {
        ...defaultSettings(),
        projectLinks: [{ id: 'link-side', path: PRIVATE, target: { kind: 'private' }, createdAt: new Date(0) }],
      },
      agentLogs: logOf({ cwd: PRIVATE, title: 'the side project' }),
    });
    await page.goto('/day');

    const cursor = await storedCursor(page);

    expect(cursor?.cwd).toBeUndefined();
    expect(cursor?.title).toBeUndefined();
    expect(cursor?.session).toBeUndefined();
    expect(cursor?.nextLine).toBe(3);
  });

  test('keeps neither for a checkout an exclusion rule denies', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), exclusionRules: [{ kind: 'title-pattern', pattern: 'dev/side' }] },
      agentLogs: logOf({ cwd: PRIVATE, title: 'the side project' }),
    });
    await page.goto('/day');

    const cursor = await storedCursor(page);

    expect(cursor?.cwd).toBeUndefined();
    expect(cursor?.title).toBeUndefined();
  });

  test('drops a title a rule denies and keeps the checkout it may re-read', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), exclusionRules: [{ kind: 'title-pattern', pattern: 'salary' }] },
      agentLogs: logOf({ cwd: WORK, title: 'the salary review' }),
    });
    await page.goto('/day');

    const cursor = await storedCursor(page);

    expect(cursor?.title).toBeUndefined();
    expect(cursor?.cwd).toBe(WORK);
  });

  test('redacts the query string of a URL inside a title it keeps', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: defaultSettings(),
      agentLogs: logOf({ cwd: WORK, title: 'reset at https://mail.example.com/r?token=abc' }),
    });
    await page.goto('/day');

    const cursor = await storedCursor(page);

    expect(cursor?.title).toBe('reset at https://mail.example.com/r');
  });
});
