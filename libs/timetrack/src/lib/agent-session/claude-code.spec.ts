import { describe, expect, it } from 'vitest';
import { AgentSessionEvent } from '../model/event';
import { parseClaudeCodeSessionLog } from './claude-code';

const SESSION = '154009aa-3442-401d-852b-07a0d5156e97';
const CWD = '/home/tom/dev/fut-frontend';
const BRANCH = 'feat/FIP-2177-user-management';

const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 7, 11, 9, minute, second));

const record = (options: { minute: number; second?: number; cwd?: string; branch?: string; type?: string }) =>
  JSON.stringify({
    type: options.type ?? 'assistant',
    uuid: `uuid-${options.minute}-${options.second ?? 0}`,
    timestamp: at(options.minute, options.second).toISOString(),
    cwd: options.cwd ?? CWD,
    sessionId: SESSION,
    version: '2.1.227',
    gitBranch: options.branch ?? BRANCH,
  });

const aiTitle = (title: string) => JSON.stringify({ type: 'ai-title', sessionId: SESSION, aiTitle: title });

const customTitle = (title: string) => JSON.stringify({ type: 'custom-title', sessionId: SESSION, customTitle: title });

const lastPrompt = (prompt: string) =>
  JSON.stringify({ type: 'last-prompt', sessionId: SESSION, leafUuid: 'leaf', lastPrompt: prompt });

const parse = (lines: string[], options: Partial<Parameters<typeof parseClaudeCodeSessionLog>[0]> = {}) =>
  parseClaudeCodeSessionLog({ lines, ...options });

const times = (events: AgentSessionEvent[]) => events.map((event) => event.at.toISOString());

describe('parseClaudeCodeSessionLog', () => {
  it('reads a session as activity samples carrying its directory, branch and title', () => {
    const result = parse([record({ minute: 0 }), aiTitle('Handoff resume SDK release'), record({ minute: 5 })]);

    expect(result.events).toEqual([
      {
        at: at(0),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: SESSION,
        cwd: CWD,
        gitBranch: BRANCH,
        title: 'Handoff resume SDK release',
      },
      { ...result.events[1], at: at(5) },
    ]);
    expect(result.title).toBe('Handoff resume SDK release');
    expect(result.unparsedLines).toBe(0);
  });

  it('thins a burst of records to one sample per interval', () => {
    const lines = [0, 2, 4, 20, 40, 62].map((second) => record({ minute: 0, second }));

    const result = parse(lines, { sampleIntervalMs: 60_000 });

    expect(times(result.events)).toEqual([at(0, 0), at(0, 62)].map((date) => date.toISOString()));
  });

  it('always emits the final record so a block ends where the session did', () => {
    const result = parse([record({ minute: 0 }), record({ minute: 0, second: 10 })], { sampleIntervalMs: 60_000 });

    expect(times(result.events)).toEqual([at(0, 0), at(0, 10)].map((date) => date.toISOString()));
  });

  it('does not emit a duplicate when the final record shares the last sample instant', () => {
    const line = record({ minute: 0 });

    const result = parse([line, line], { sampleIntervalMs: 60_000 });

    expect(result.events).toHaveLength(1);
  });

  it('emits on a branch switch even inside the sampling interval', () => {
    const result = parse([record({ minute: 0 }), record({ minute: 0, second: 5, branch: 'feat/FIP-2200-club-pack' })], {
      sampleIntervalMs: 60_000,
    });

    expect(result.events.map((event) => event.gitBranch)).toEqual([BRANCH, 'feat/FIP-2200-club-pack']);
  });

  it('reads a detached checkout as no branch at all', () => {
    const result = parse([record({ minute: 0, branch: 'HEAD' })]);

    expect(result.events[0]?.gitBranch).toBeUndefined();
  });

  it('emits when a detached checkout returns to a branch', () => {
    const result = parse([record({ minute: 0, branch: 'HEAD' }), record({ minute: 0, second: 5 })], {
      sampleIntervalMs: 60_000,
    });

    expect(result.events.map((event) => event.gitBranch)).toEqual([undefined, BRANCH]);
  });

  it('emits on a working-directory switch even inside the sampling interval', () => {
    const result = parse([record({ minute: 0 }), record({ minute: 0, second: 5, cwd: '/home/tom/dev/ethlete-sdk' })], {
      sampleIntervalMs: 60_000,
    });

    expect(result.events.map((event) => event.cwd)).toEqual([CWD, '/home/tom/dev/ethlete-sdk']);
  });

  it('samples every record type that carries the metadata', () => {
    const lines = ['user', 'assistant', 'system', 'attachment', 'queue-operation'].map((type, index) =>
      record({ minute: index * 2, type }),
    );

    const result = parse(lines);

    expect(result.events).toHaveLength(5);
  });

  it('ignores records with no timestamp, directory or session id', () => {
    const result = parse([
      JSON.stringify({ type: 'mode', sessionId: SESSION, mode: 'default' }),
      JSON.stringify({ type: 'file-history-delta', timestamp: at(1).toISOString() }),
      JSON.stringify({ type: 'assistant', timestamp: 'not a date', cwd: CWD, sessionId: SESSION }),
      record({ minute: 3 }),
    ]);

    expect(times(result.events)).toEqual([at(3).toISOString()]);
    expect(result.unparsedLines).toBe(0);
  });

  it('counts a partial trailing line rather than throwing on it', () => {
    const result = parse([record({ minute: 0 }), '{"type":"assist', '']);

    expect(result.events).toHaveLength(1);
    expect(result.unparsedLines).toBe(1);
  });

  it('sorts records that arrive out of order before sampling', () => {
    const result = parse([record({ minute: 5 }), record({ minute: 0 })], { sampleIntervalMs: 60_000 });

    expect(times(result.events)).toEqual([at(0), at(5)].map((date) => date.toISOString()));
  });

  it('keeps sessions apart when a log holds more than one', () => {
    const other = JSON.stringify({
      type: 'assistant',
      timestamp: at(0, 5).toISOString(),
      cwd: CWD,
      sessionId: 'other-session',
      gitBranch: BRANCH,
    });

    const result = parse([record({ minute: 0 }), other], { sampleIntervalMs: 60_000 });

    expect(result.events.map((event) => event.sessionId)).toEqual([SESSION, 'other-session']);
  });

  describe('titles', () => {
    it('prefers the last generated title, since it is regenerated as the session grows', () => {
      const result = parse([record({ minute: 0 }), aiTitle('First guess'), aiTitle('Timetrack agent collector')]);

      expect(result.title).toBe('Timetrack agent collector');
    });

    it('prefers the name the user gave the session over the generated one', () => {
      const result = parse([record({ minute: 0 }), aiTitle('Timetrack agent collector'), customTitle('claude-at/wip')]);

      expect(result.title).toBe('claude-at/wip');
      expect(result.events[0]?.title).toBe('claude-at/wip');
    });

    it('prefers the last name the user gave, since renaming rewrites the record', () => {
      const result = parse([record({ minute: 0 }), customTitle('claude-at/wip'), customTitle('claude-at/collector')]);

      expect(result.title).toBe('claude-at/collector');
    });

    it('leaves the title unset when nothing generated one and no fallback is asked for', () => {
      const result = parse([record({ minute: 0 }), lastPrompt('add the agent session collector')]);

      expect(result.title).toBeUndefined();
      expect(result.events[0]?.title).toBeUndefined();
    });

    it('falls back to the first prompt, collapsed to one line', () => {
      const result = parse(
        [record({ minute: 0 }), lastPrompt('add the\n  agent  session\ncollector'), lastPrompt('go on')],
        {
          promptFallback: { maxLength: 60 },
        },
      );

      expect(result.title).toBe('add the agent session collector');
    });

    it('truncates a long prompt fallback', () => {
      const result = parse([record({ minute: 0 }), lastPrompt('a'.repeat(50))], { promptFallback: { maxLength: 10 } });

      expect(result.title).toBe(`${'a'.repeat(10)}…`);
    });

    it('prefers a generated title over the prompt fallback', () => {
      const result = parse([record({ minute: 0 }), lastPrompt('add the collector'), aiTitle('Agent collector')], {
        promptFallback: { maxLength: 60 },
      });

      expect(result.title).toBe('Agent collector');
    });
  });

  describe('resuming a tail', () => {
    it('skips records at or before the cursor', () => {
      const lines = [record({ minute: 0 }), record({ minute: 5 }), record({ minute: 10 })];

      const result = parse(lines, { resume: { after: at(5) } });

      expect(times(result.events)).toEqual([at(10).toISOString()]);
    });

    it('carries the title the earlier batch resolved', () => {
      const result = parse([record({ minute: 10 })], { resume: { after: at(5), title: 'Agent collector' } });

      expect(result.events[0]?.title).toBe('Agent collector');
    });

    it('lets a title in the new records replace the carried one', () => {
      const result = parse([record({ minute: 10 }), aiTitle('Agent collector, second half')], {
        resume: { after: at(5), title: 'Agent collector' },
      });

      expect(result.title).toBe('Agent collector, second half');
    });

    it('prefers the carried title over the prompt fallback', () => {
      const result = parse([record({ minute: 10 }), lastPrompt('go on')], {
        resume: { after: at(5), title: 'Agent collector' },
        promptFallback: { maxLength: 60 },
      });

      expect(result.title).toBe('Agent collector');
    });
  });
});
