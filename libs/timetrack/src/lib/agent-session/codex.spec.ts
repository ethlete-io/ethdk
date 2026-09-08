import { describe, expect, it } from 'vitest';
import { CODEX_PROVIDER, parseCodexSessionLog } from './codex';
import { AgentLogSessionState } from './source';

const CWD = '/home/tom/dev/ethlete-sdk';
const SESSION = '01a016ac-fe48-73d1-bf46-fc7e92d6c807';

let nextOrdinal = 0;

const line = (options: { timestamp: string; type: string; payload: Record<string, unknown> }) =>
  JSON.stringify({ timestamp: options.timestamp, ordinal: nextOrdinal++, ...options });

const sessionMeta = (timestamp: string, cwd = CWD) =>
  line({ timestamp, type: 'session_meta', payload: { session_id: SESSION, cwd, cli_version: '0.147.0' } });

const turnContext = (timestamp: string, options?: { model?: string; cwd?: string }) =>
  line({
    timestamp,
    type: 'turn_context',
    payload: { turn_id: 't1', cwd: options?.cwd ?? CWD, model: options?.model ?? 'gpt-5.6-sol' },
  });

const counts = (options: { input?: number; cached?: number; output?: number; reasoning?: number }) => ({
  input_tokens: options.input ?? 0,
  cached_input_tokens: options.cached ?? 0,
  cache_write_input_tokens: 0,
  output_tokens: options.output ?? 0,
  reasoning_output_tokens: options.reasoning ?? 0,
  total_tokens: (options.input ?? 0) + (options.output ?? 0),
});

const tokenCount = (
  timestamp: string,
  options?: { input?: number; cached?: number; output?: number; reasoning?: number },
) =>
  line({
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: { last_token_usage: counts(options ?? {}), total_token_usage: counts({ input: 999_999 }) },
    },
  });

const item = (timestamp: string) =>
  line({ timestamp, type: 'event_msg', payload: { type: 'item_completed', item: { id: 'i1' } } });

const parse = (options: {
  lines: string[];
  resume?: { after?: Date; cwd?: string; session?: AgentLogSessionState };
  sampleIntervalMs?: number;
}) => {
  nextOrdinal = 0;

  return parseCodexSessionLog({
    lines: options.lines,
    resume: options.resume,
    sampleIntervalMs: options.sampleIntervalMs ?? 0,
  });
};

describe('parseCodexSessionLog', () => {
  it('takes the session and the checkout from the header and samples every timestamped record', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:04:23.696Z'),
        turnContext('2026-08-18T21:04:24.046Z'),
        item('2026-08-18T21:05:00.000Z'),
      ],
    });

    expect(result.events).toEqual([
      {
        at: new Date('2026-08-18T21:04:23.696Z'),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: SESSION,
        cwd: CWD,
      },
      {
        at: new Date('2026-08-18T21:04:24.046Z'),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: SESSION,
        cwd: CWD,
      },
      {
        at: new Date('2026-08-18T21:05:00.000Z'),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: SESSION,
        cwd: CWD,
      },
    ]);
  });

  it('samples nothing before the header names the session', () => {
    const result = parse({ lines: [item('2026-08-18T21:04:00.000Z'), sessionMeta('2026-08-18T21:04:23.696Z')] });

    expect(result.events).toEqual([
      {
        at: new Date('2026-08-18T21:04:23.696Z'),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: SESSION,
        cwd: CWD,
      },
    ]);
  });

  it('reads a turn as its own counts and leaves the cache read out of the input', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:04:23.696Z'),
        turnContext('2026-08-18T21:04:24.046Z'),
        tokenCount('2026-08-18T21:04:30.207Z', { input: 20_063, cached: 11_008, output: 204, reasoning: 48 }),
      ],
    });

    expect(result.usage).toEqual([
      {
        at: new Date('2026-08-18T21:04:30.207Z'),
        source: 'agent-usage',
        kind: 'agent-usage',
        provider: CODEX_PROVIDER,
        sessionId: SESSION,
        turnId: `${SESSION}#2`,
        cwd: CWD,
        model: 'gpt-5.6-sol',
        usage: { input: 9_055, output: 204, cacheWrite: 0, cacheRead: 11_008, thinking: 48 },
      },
    ]);
  });

  it('skips the turn-start report, whose counts are all zero and whose total is the context window', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:04:23.696Z'),
        turnContext('2026-08-18T21:04:24.046Z'),
        line({
          timestamp: '2026-08-18T21:04:24.100Z',
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: { last_token_usage: { ...counts({}), total_tokens: 16_614 } },
          },
        }),
      ],
    });

    expect(result.usage).toEqual([]);
  });

  it('skips a token_count that reports rate limits only', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:04:23.696Z'),
        turnContext('2026-08-18T21:04:24.046Z'),
        line({
          timestamp: '2026-08-18T21:04:30.207Z',
          type: 'event_msg',
          payload: { type: 'token_count', info: null, rate_limits: { limit_id: 'codex' } },
        }),
      ],
    });

    expect(result.usage).toEqual([]);
  });

  it('prices a resumed read from the model the cursor carried, not from a turn_context it cannot see', () => {
    const result = parse({
      lines: [tokenCount('2026-08-18T21:20:00.000Z', { input: 100, output: 10 })],
      resume: {
        after: new Date('2026-08-18T21:10:00.000Z'),
        cwd: CWD,
        session: { sessionId: SESSION, model: 'gpt-5.6-sol' },
      },
    });

    expect(result.usage.map((event) => [event.turnId, event.model, event.cwd])).toEqual([
      [`${SESSION}#0`, 'gpt-5.6-sol', CWD],
    ]);
  });

  it('reports no spend for a turn whose model nothing has named yet', () => {
    const result = parse({
      lines: [sessionMeta('2026-08-18T21:04:23.696Z'), tokenCount('2026-08-18T21:04:30.207Z', { input: 100 })],
    });

    expect(result.usage).toEqual([]);
  });

  it('hands back the session and the model it ends on', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:04:23.696Z'),
        turnContext('2026-08-18T21:04:24.046Z'),
        turnContext('2026-08-18T21:40:00.000Z', { model: 'gpt-5.6-pro' }),
      ],
    });

    expect(result.session).toEqual({ sessionId: SESSION, model: 'gpt-5.6-pro' });
  });

  it('drops a sample the cursor has already seen and keeps the spend beside it', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:04:23.696Z'),
        turnContext('2026-08-18T21:04:24.046Z'),
        tokenCount('2026-08-18T21:04:30.207Z', { input: 100, output: 10 }),
        item('2026-08-18T21:30:00.000Z'),
      ],
      resume: { after: new Date('2026-08-18T21:10:00.000Z') },
    });

    expect(result.events.map((event) => event.at.toISOString())).toEqual(['2026-08-18T21:30:00.000Z']);
    expect(result.usage.map((event) => event.at.toISOString())).toEqual(['2026-08-18T21:04:30.207Z']);
  });

  it('thins the samples to the interval but always emits a change of checkout and the last record', () => {
    const result = parse({
      lines: [
        sessionMeta('2026-08-18T21:00:00.000Z'),
        item('2026-08-18T21:00:30.000Z'),
        item('2026-08-18T21:01:00.000Z'),
        turnContext('2026-08-18T21:01:10.000Z', { cwd: '/home/tom/dev/fut-frontend' }),
        item('2026-08-18T21:01:20.000Z'),
      ],
      sampleIntervalMs: 60_000,
    });

    expect(result.events.map((event) => [event.at.toISOString(), event.cwd])).toEqual([
      ['2026-08-18T21:00:00.000Z', CWD],
      ['2026-08-18T21:01:00.000Z', CWD],
      ['2026-08-18T21:01:10.000Z', '/home/tom/dev/fut-frontend'],
      ['2026-08-18T21:01:20.000Z', '/home/tom/dev/fut-frontend'],
    ]);
  });

  it('counts a line that is not a JSON record and reads the rest of the batch', () => {
    const result = parse({
      lines: [sessionMeta('2026-08-18T21:04:23.696Z'), '{"timestamp":', '[]', item('2026-08-18T21:05:00.000Z')],
    });

    expect(result.unparsedLines).toBe(2);
    expect(result.events).toHaveLength(2);
  });

  it('reports no branch, because a rollout log records none', () => {
    const result = parse({ lines: [sessionMeta('2026-08-18T21:04:23.696Z')] });

    expect(result.events[0]).not.toHaveProperty('gitBranch');
  });
});
