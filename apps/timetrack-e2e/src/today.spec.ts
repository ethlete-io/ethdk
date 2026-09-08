import { CollectedEvent, GIT_FIELD_SEPARATOR } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The checkout the fake git backend discovers, so its subdirectories fold into it. */
const FUT = '/Users/e2e/dev/fut-frontend';

/** A second checkout the host discovers. An agent ran in it and no window ever showed it. */
const SDK = '/Users/e2e/dev/ethlete-sdk';

/**
 * What the fake host reports as the repositories on this machine, beside `FUT`.
 *
 * A prompt and a turn are the two marks kept for a checkout no project link covers, so a directory
 * they name is only a stream of its own when something says it is a checkout. Here the git discovery
 * is that something, as it is on a real machine.
 */
const DISCOVERED = { extraRepos: [SDK] };

/** Nine in the morning on the seeded day. The browser is pinned to UTC, so this is 09:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const focus = (minutes: number, appId: string, title: string): CollectedEvent => ({
  at: at(minutes),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const editing = (minutes: number) => focus(minutes, 'code', 'invite.ts - fut-frontend - Visual Studio Code');

const session = (minutes: number): CollectedEvent => ({
  at: at(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-sdk',
  cwd: SDK,
  gitBranch: 'next',
  title: 'Read a day as streams',
});

/**
 * One two-hour morning that ran three streams: an editor in one checkout, an agent in another that
 * nothing ever focused, and half an hour in Slack. It is the shape slice 1 exists to report — the
 * numbers each line must show are worked out in the test below.
 */
const day = (): CollectedEvent[] => [
  { at: at(0), source: 'git', kind: 'git-checkout', repoPath: FUT, branch: 'next' },
  ...[0, 15, 30, 45, 90, 105, 120].map(editing),
  ...[60, 75].map((minutes) => focus(minutes, 'slack', 'Slack')),
  ...Array.from({ length: 13 }, (_, step) => session(32 + step * 5)),
  {
    at: at(60),
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: 'claude-code',
    sessionId: 'session-sdk',
    turnId: 'turn-1',
    cwd: SDK,
    model: 'claude-opus-5',
    usage: { input: 12_000, output: 1_200_000, cacheWrite: 40_000, cacheRead: 604_000_000, thinking: 30_000 },
  },
];

/**
 * One Claude Code record. A `user` record whose content is a plain string is a prompt the person
 * typed; an `assistant` record with `message.usage` is a turn the machine spent.
 */
const claudeRecord = (options: { minutes: number; typed?: boolean; id: string }) =>
  JSON.stringify({
    type: options.typed ? 'user' : 'assistant',
    uuid: options.id,
    timestamp: at(options.minutes).toISOString(),
    cwd: SDK,
    sessionId: 'session-rebuilt',
    gitBranch: 'next',
    message: options.typed
      ? { role: 'user', content: 'read the day back' }
      : {
          id: options.id,
          model: 'claude-opus-5',
          role: 'assistant',
          usage: {
            input_tokens: 100,
            output_tokens: 2_000,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 500_000,
            output_tokens_details: { thinking_tokens: 0 },
          },
        },
  });

/**
 * A log of a morning nothing watched: three prompts twenty minutes apart, with the agent's turns
 * between them. The turns are what carry the stretch over the gaps the prompts leave.
 */
const rebuiltLog = (): string[] => [
  claudeRecord({ minutes: 0, typed: true, id: 'prompt-0' }),
  claudeRecord({ minutes: 5, id: 'msg_5' }),
  claudeRecord({ minutes: 12, id: 'msg_12' }),
  claudeRecord({ minutes: 20, typed: true, id: 'prompt-20' }),
  claudeRecord({ minutes: 28, id: 'msg_28' }),
  claudeRecord({ minutes: 35, id: 'msg_35' }),
  claudeRecord({ minutes: 40, typed: true, id: 'prompt-40' }),
];

/** One record of a Codex rollout log. `ordinal` is what a `token_count` is identified as a turn by. */
const codexRecord = (options: { minutes: number; type: string; payload: Record<string, unknown>; ordinal: number }) =>
  JSON.stringify({
    timestamp: at(options.minutes).toISOString(),
    type: options.type,
    payload: options.payload,
    ordinal: options.ordinal,
  });

const codexCounts = (output: number) => ({
  input_tokens: 4_000,
  cached_input_tokens: 1_000,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: 500,
  total_tokens: 4_000 + output,
});

/**
 * A rollout log the Codex passes read: the session it belongs to, the turn's checkout and model, and
 * two turns that spent something. The zero-valued `token_count` Codex opens a turn with is the
 * context window rather than spend, so this holds none.
 */
const codexRollout = (): string[] => [
  codexRecord({
    minutes: 30,
    type: 'session_meta',
    payload: { session_id: 'codex-e2e', cwd: SDK, cli_version: '0.147.0' },
    ordinal: 0,
  }),
  codexRecord({
    minutes: 31,
    type: 'turn_context',
    payload: { turn_id: 't1', cwd: SDK, model: 'gpt-5-codex' },
    ordinal: 1,
  }),
  ...[35, 45].map((minutes, step) =>
    codexRecord({
      minutes,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { last_token_usage: codexCounts(200_000 * (step + 1)), total_token_usage: codexCounts(999_999) },
      },
      ordinal: 2 + step,
    }),
  ),
];

const stream = (page: Parameters<typeof seedWorld>[0], key: string) => page.locator(`[data-stream="${key}"]`);

/** One line of `git reflog show`, in the format the app asks for. */
const reflogLine = (options: { stamp: string; from: string; to: string }) =>
  `HEAD@{${options.stamp}}${GIT_FIELD_SEPARATOR}checkout: moving from ${options.from} to ${options.to}`;

test.describe('the today view', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: day(), git: DISCOVERED });
    await page.goto('/today');
  });

  test('reports presence, engaged time and the ratio between them', async ({ page }) => {
    const totals = page.locator('[data-totals]');

    // The morning was two hours at the machine. The editor held 90 minutes of it and Slack 30, and
    // the agent's hour ran alongside — so the day was engaged for three hours in two.
    await expect(totals).toContainText('2h 0m present');
    await expect(totals).toContainText('3h 0m engaged');
    await expect(totals).toContainText('1.5× at once');
  });

  test('shows one line per checkout, ordered by when it started', async ({ page }) => {
    await expect(page.locator('[data-stream] [data-label]')).toHaveText([
      'fut-frontend',
      'ethlete-sdk',
      'Other applications',
    ]);
  });

  test('gives the focused window its checkout, and the rest to one folded line', async ({ page }) => {
    await expect(stream(page, `repo:${FUT}`).locator('[data-engaged]')).toHaveText('1h 30m engaged');
    await expect(stream(page, 'other-applications').locator('[data-engaged]')).toHaveText('30m engaged');
    await expect(stream(page, 'other-applications')).toContainText('Slack');
  });

  test('books a checkout an agent ran in, and says nobody ever looked at it', async ({ page }) => {
    const agentOnly = stream(page, `repo:${SDK}`);

    await expect(agentOnly.locator('[data-engaged]')).toHaveText('1h 0m engaged');
    await expect(agentOnly.locator('[data-agent-sessions]')).toHaveText('1 agent session');
    await expect(agentOnly.locator('[data-never-focused]')).toHaveText('agent only, never focused');
    await expect(agentOnly).toContainText('Read a day as streams');
  });

  test("holds a stream's evidence closed until its header is opened", async ({ page }) => {
    const agentOnly = stream(page, `repo:${SDK}`);
    const evidence = agentOnly.getByText('Read a day as streams');

    await expect(evidence).toBeHidden();

    await agentOnly.getByRole('button', { name: /ethlete-sdk/ }).click();

    await expect(evidence).toBeVisible();
  });

  test('reads the branch out of the reflog for a checkout the day named none for', async ({ page }) => {
    // Nothing that day says which branch the checkout was on: no commit, no switch, and an agent
    // session that carried no branch. The reflog is the only thing left that knows.
    await seedWorld(page, {
      now: E2E_NOW,
      events: day().map((event) => (event.kind === 'agent-session' ? { ...event, gitBranch: undefined } : event)),
      git: {
        ...DISCOVERED,
        reflog: {
          [SDK]: reflogLine({ stamp: '2026-07-01T09:00:00+02:00', from: 'main', to: 'feature/read-a-day' }),
        },
      },
    });
    await page.goto('/today');

    await expect(stream(page, `repo:${SDK}`).locator('[data-branches]')).toHaveText('feature/read-a-day');
  });

  test('says nothing about a branch for a checkout whose reflog holds no switch', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: DISCOVERED,
      events: day().map((event) => (event.kind === 'agent-session' ? { ...event, gitBranch: undefined } : event)),
    });
    await page.goto('/today');

    await expect(stream(page, `repo:${SDK}`).locator('[data-branches]')).toHaveCount(0);
  });

  test('shows what the turns spent, in the classes they are priced in', async ({ page }) => {
    await expect(stream(page, `repo:${SDK}`).locator('[data-spend]')).toHaveText('1 turn · 1.2 M out · 604 M cached');
  });

  test('reads a codex rollout log and books its turns on the checkout the turn ran in', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: DISCOVERED,
      events: day(),
      // The backfill keeps only a checkout a project link covers, the same filter the session
      // collector applies. Without the link the rollout's turns are dropped before the store.
      settings: {
        ...defaultSettings(),
        projectLinks: [
          { id: 'link-sdk', path: SDK, target: { kind: 'project', projectKey: 'ABC' }, createdAt: new Date(0) },
        ],
      },
      codexLogs: [
        {
          id: 'rollout-codex-e2e',
          path: '/Users/e2e/.codex/sessions/2026/08/12/rollout-codex-e2e.jsonl',
          modifiedAt: `${E2E_DAY_KEY}T12:00:00.000Z`,
          lines: codexRollout(),
        },
      ],
    });
    await page.goto('/today');

    // One claude-code turn is already in the day's events; the two the rollout holds join it.
    await expect(stream(page, `repo:${SDK}`).locator('[data-spend]')).toContainText('3 turns');
    await expect(page.locator('[data-unattributed]')).toHaveCount(0);
  });

  test('books what an agent spent while nobody was at the machine, and calls that time unattended', async ({
    page,
  }) => {
    // The machine locks at noon and the agent works on in the SDK checkout for another hour. The
    // customer pays for that hour's turns, so the checkout books them; the day does not call it presence.
    await seedWorld(page, {
      now: E2E_NOW,
      git: DISCOVERED,
      events: [
        ...day(),
        { at: at(121), source: 'idle', kind: 'lock' },
        ...Array.from({ length: 7 }, (_, step) => session(180 + step * 10)),
        {
          at: at(200),
          source: 'agent-usage',
          kind: 'agent-usage',
          provider: 'claude-code',
          sessionId: 'session-sdk',
          turnId: 'turn-away',
          cwd: SDK,
          model: 'claude-opus-5',
          usage: { input: 500, output: 800_000, cacheWrite: 0, cacheRead: 90_000_000, thinking: 0 },
        },
      ],
    });
    await page.goto('/today');

    const agentOnly = stream(page, `repo:${SDK}`);

    await expect(agentOnly.locator('[data-unattended]')).toHaveText('1h 0m unattended');
    await expect(agentOnly.locator('[data-engaged]')).toHaveText('1h 0m engaged');
    await expect(agentOnly.locator('[data-spend]')).toContainText('2 turns');
    await expect(page.locator('[data-totals]')).toContainText('+ 1h 0m unattended');
    await expect(page.locator('[data-unattributed]')).toHaveCount(0);
  });

  test('gives a checkout the backfill found turns for a line of its own, with spend and no time', async ({ page }) => {
    // What a replayed day looks like: the spend pass read an old log the session collector never saw.
    await seedWorld(page, {
      now: E2E_NOW,
      git: DISCOVERED,
      events: [
        ...day().filter((event) => event.source !== 'agent-session'),
        {
          at: at(65),
          source: 'agent-usage',
          kind: 'agent-usage',
          provider: 'codex',
          sessionId: 'session-codex',
          turnId: 'turn-codex',
          cwd: SDK,
          model: 'gpt-5-codex',
          usage: { input: 500, output: 800_000, cacheWrite: 0, cacheRead: 90_000_000, thinking: 0 },
        },
      ],
    });
    await page.goto('/today');

    const backfilled = stream(page, `repo:${SDK}`);

    await expect(backfilled.locator('[data-engaged]')).toHaveText('0m engaged');
    await expect(backfilled.locator('[data-spend]')).toContainText('2 turns');
    await expect(page.locator('[data-unattributed]')).toHaveCount(0);
  });

  test('names a checkout name two checkouts share, rather than folding the time in silence', async ({ page }) => {
    const ONE = '/Users/e2e/dev/elrond';
    const OTHER = '/Users/e2e/archive/elrond';

    await seedWorld(page, {
      now: E2E_NOW,
      events: [...day(), focus(10, 'code', 'boot.md - elrond - Visual Studio Code')],
      git: { extraRepos: [...DISCOVERED.extraRepos, ONE, OTHER] },
    });
    await page.goto('/today');

    await expect(page.locator('[data-ambiguous]')).toHaveText('elrond');
    await expect(page.locator('[data-stream="repo:' + ONE + '"]')).toHaveCount(0);
  });

  test('names only the spend that carries no checkout at all', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      git: DISCOVERED,
      events: [
        ...day(),
        {
          at: at(60),
          source: 'agent-usage',
          kind: 'agent-usage',
          provider: 'claude-code',
          sessionId: 'session-nowhere',
          turnId: 'turn-nowhere',
          cwd: '',
          model: 'claude-opus-5',
          usage: { input: 500, output: 800_000, cacheWrite: 0, cacheRead: 90_000_000, thinking: 0 },
        },
      ],
    });
    await page.goto('/today');

    await expect(page.locator('[data-unattributed]')).toHaveText('1 turn · 800 k out · 90.0 M cached');
  });

  test('shows no unbooked line for a day every turn belongs to a stream', async ({ page }) => {
    await expect(page.locator('[data-unattributed]')).toHaveCount(0);
  });

  test('rebuilds a day no window watched from the prompts the user typed', async ({ page }) => {
    // Nothing was collected on the day itself: no focus sample, no idle transition and no session.
    // The prompt pass reads the log afterwards, and the turns between two prompts carry the stretch.
    await seedWorld(page, {
      now: E2E_NOW,
      git: DISCOVERED,
      events: [],
      agentLogs: [
        {
          id: 'session-rebuilt',
          path: '/Users/e2e/.claude/projects/-Users-e2e-dev-ethlete-sdk/session-rebuilt.jsonl',
          modifiedAt: `${E2E_DAY_KEY}T12:00:00.000Z`,
          lines: rebuiltLog(),
        },
      ],
    });
    await page.goto('/today');

    const rebuilt = stream(page, `repo:${SDK}`);

    await expect(rebuilt.locator('[data-engaged]')).toHaveText('40m engaged');
    await expect(rebuilt.locator('[data-rebuilt]')).toHaveText('40m rebuilt');
    await expect(page.locator('[data-presence]')).toHaveText('40m present');
    await expect(page.locator('[data-rebuilt-total]')).toHaveText('40m rebuilt');
    await expect(page.getByText(/Part of this day was rebuilt/)).toBeVisible();
  });

  test('says so for a day nothing observed', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [] });
    await page.goto('/today');

    await expect(page.getByText(/Nothing observed this day/)).toBeVisible();
  });
});
