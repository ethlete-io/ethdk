import { describe, expect, it } from 'vitest';
import { AgentSessionEvent } from '../model/event';
import { CLAUDE_CODE_PROVIDER, parseClaudeCodeSessionLog } from './claude-code';

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

type UsageCounts = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  thinking_tokens?: number;
};

const turn = (options: {
  minute: number;
  second?: number;
  id?: string;
  model?: string;
  cwd?: string;
  branch?: string;
  agentId?: string;
  counts?: UsageCounts;
  extra?: Record<string, unknown>;
}) => {
  const counts = options.counts ?? {};

  return JSON.stringify({
    type: 'assistant',
    uuid: `uuid-${options.minute}-${options.second ?? 0}`,
    timestamp: at(options.minute, options.second).toISOString(),
    cwd: options.cwd ?? CWD,
    sessionId: SESSION,
    gitBranch: options.branch ?? BRANCH,
    ...(options.agentId ? { agentId: options.agentId, isSidechain: true } : {}),
    message: {
      id: options.id ?? `msg_${options.minute}`,
      model: options.model ?? 'claude-opus-5',
      role: 'assistant',
      usage: {
        input_tokens: counts.input_tokens ?? 0,
        output_tokens: counts.output_tokens ?? 0,
        cache_creation_input_tokens: counts.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: counts.cache_read_input_tokens ?? 0,
        output_tokens_details: { thinking_tokens: counts.thinking_tokens ?? 0 },
        ...(options.extra ?? {}),
      },
    },
  });
};

const prompt = (options: {
  minute: number;
  second?: number;
  content?: unknown;
  cwd?: string;
  extra?: Record<string, unknown>;
}) =>
  JSON.stringify({
    type: 'user',
    uuid: `prompt-${options.minute}-${options.second ?? 0}`,
    timestamp: at(options.minute, options.second).toISOString(),
    cwd: options.cwd ?? CWD,
    sessionId: SESSION,
    gitBranch: BRANCH,
    ...(options.extra ?? {}),
    message: { role: 'user', content: options.content ?? 'fix the failing spec' },
  });

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

describe('parseClaudeCodeSessionLog, on token spend', () => {
  it('reads one turn as the five counts it is priced by', () => {
    const result = parse([
      turn({
        minute: 0,
        counts: {
          input_tokens: 2,
          output_tokens: 289,
          cache_creation_input_tokens: 17_421,
          cache_read_input_tokens: 18_910,
          thinking_tokens: 96,
        },
      }),
    ]);

    expect(result.usage).toEqual([
      {
        at: at(0),
        source: 'agent-usage',
        kind: 'agent-usage',
        provider: CLAUDE_CODE_PROVIDER,
        sessionId: SESSION,
        turnId: 'msg_0',
        cwd: CWD,
        gitBranch: BRANCH,
        model: 'claude-opus-5',
        usage: { input: 2, output: 289, cacheWrite: 17_421, cacheRead: 18_910, thinking: 96 },
        agentId: undefined,
      },
    ]);
  });

  it('counts a turn once, however many records restate its usage', () => {
    const result = parse([
      turn({ minute: 0, id: 'msg_a', counts: { output_tokens: 100 } }),
      turn({ minute: 0, second: 4, id: 'msg_a', counts: { output_tokens: 100 } }),
      turn({ minute: 1, id: 'msg_b', counts: { output_tokens: 40 } }),
    ]);

    expect(result.usage.map((event) => event.turnId)).toEqual(['msg_a', 'msg_b']);
    expect(result.usage.map((event) => event.usage.output)).toEqual([100, 40]);
  });

  it('reports every turn, however far the samples are thinned', () => {
    const lines = [0, 2, 4].map((second) => turn({ minute: 0, second, id: `msg_${second}` }));

    const result = parse(lines, { sampleIntervalMs: 60_000 });

    expect(result.events).toHaveLength(2);
    expect(result.usage).toHaveLength(3);
  });

  it('reports a turn behind the resume cursor, because a count is not a repeated sample', () => {
    const result = parse([turn({ minute: 0, id: 'msg_early' })], { resume: { after: at(5) } });

    expect(result.events).toEqual([]);
    expect(result.usage.map((event) => event.turnId)).toEqual(['msg_early']);
  });

  it('skips the synthetic model, which reports a turn nobody ran', () => {
    const result = parse([turn({ minute: 0, model: '<synthetic>' }), turn({ minute: 1, id: 'msg_real' })]);

    expect(result.usage.map((event) => event.turnId)).toEqual(['msg_real']);
  });

  it('reads the top level of usage only, never the per-call iterations that restate it', () => {
    const result = parse([
      turn({
        minute: 0,
        counts: { output_tokens: 187 },
        extra: { iterations: [{ output_tokens: 187 }, { output_tokens: 187 }] },
      }),
    ]);

    expect(result.usage.map((event) => event.usage.output)).toEqual([187]);
  });

  it('names the subagent that ran the turn, and keeps its spend in the parent session', () => {
    const result = parse([turn({ minute: 0, agentId: 'a37a4fb79537e0377' })]);

    expect(result.usage[0]).toMatchObject({ sessionId: SESSION, agentId: 'a37a4fb79537e0377' });
  });

  it('reads a branch and a directory per turn, so a mid-session switch is attributed to each', () => {
    const result = parse([
      turn({ minute: 0, id: 'msg_a' }),
      turn({ minute: 1, id: 'msg_b', cwd: '/home/tom/dev/ethlete-sdk', branch: 'next' }),
    ]);

    expect(result.usage.map((event) => [event.cwd, event.gitBranch])).toEqual([
      [CWD, BRANCH],
      ['/home/tom/dev/ethlete-sdk', 'next'],
    ]);
  });

  it('takes no spend from a record that reports none', () => {
    const result = parse([record({ minute: 0 }), aiTitle('A session with no usage record')]);

    expect(result.usage).toEqual([]);
  });

  it('takes no spend from a usage record the agent wrote without a turn id', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: at(0).toISOString(),
      cwd: CWD,
      sessionId: SESSION,
      message: { model: 'claude-opus-5', usage: { output_tokens: 10 } },
    });

    expect(parse([line]).usage).toEqual([]);
  });

  it('reads a missing count as zero rather than dropping the turn', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: at(0).toISOString(),
      cwd: CWD,
      sessionId: SESSION,
      message: { id: 'msg_thin', model: 'claude-opus-5', usage: { output_tokens: 10, output_tokens_details: null } },
    });

    expect(parse([line]).usage[0]?.usage).toEqual({
      input: 0,
      output: 10,
      cacheWrite: 0,
      cacheRead: 0,
      thinking: 0,
    });
  });

  it('reports the turns oldest first, whatever order the log holds them in', () => {
    const result = parse([turn({ minute: 5, id: 'msg_late' }), turn({ minute: 0, id: 'msg_early' })]);

    expect(result.usage.map((event) => event.turnId)).toEqual(['msg_early', 'msg_late']);
  });
});

describe('parseClaudeCodeSessionLog prompts', () => {
  it('reads a typed prompt as its instant, session and checkout, and never its text', () => {
    const result = parse([prompt({ minute: 5 })]);

    expect(result.prompts).toEqual([
      {
        at: at(5),
        source: 'agent-prompt',
        kind: 'agent-prompt',
        provider: CLAUDE_CODE_PROVIDER,
        sessionId: SESSION,
        promptId: 'prompt-5-0',
        cwd: CWD,
        gitBranch: BRANCH,
      },
    ]);
  });

  it('drops a tool result, which arrives as a user record too', () => {
    const result = parse([
      prompt({ minute: 5, content: [{ type: 'tool_result', content: 'ok' }], extra: { toolUseResult: { ok: true } } }),
    ]);

    expect(result.prompts).toEqual([]);
  });

  it('drops a subagent record, because the model wrote it', () => {
    expect(parse([prompt({ minute: 6, extra: { isSidechain: true } })]).prompts).toEqual([]);
  });

  it('drops a record the CLI wrote for itself', () => {
    expect(parse([prompt({ minute: 7, extra: { isMeta: true } })]).prompts).toEqual([]);
  });

  it('drops a content array, which nobody typed', () => {
    expect(parse([prompt({ minute: 8, content: [{ type: 'text', text: 'hi' }] })]).prompts).toEqual([]);
  });

  it('reports every prompt, whatever the sample interval thins the activity to', () => {
    const result = parse(
      [prompt({ minute: 5 }), prompt({ minute: 5, second: 20 }), prompt({ minute: 5, second: 40 })],
      {
        sampleIntervalMs: 60_000,
      },
    );

    expect(result.prompts.map((event) => event.at.toISOString())).toEqual([
      at(5).toISOString(),
      at(5, 20).toISOString(),
      at(5, 40).toISOString(),
    ]);
    expect(times(result.events)).toEqual([at(5).toISOString(), at(5, 40).toISOString()]);
  });

  it('reads a prompt behind the resume cursor, because the store keys it', () => {
    expect(parse([prompt({ minute: 5 })], { resume: { after: at(9) } }).prompts).toHaveLength(1);
  });

  it('says a human asked, when the record names the origin', () => {
    const result = parse([prompt({ minute: 5, extra: { origin: { kind: 'human' }, promptSource: 'typed' } })]);

    expect(result.prompts[0]?.askedBy).toBe('human');
  });

  it('says the machine asked for a task notification', () => {
    const result = parse([
      prompt({ minute: 5, extra: { origin: { kind: 'task-notification' }, promptSource: 'system' } }),
    ]);

    expect(result.prompts[0]?.askedBy).toBe('machine');
  });

  it('says the machine asked, for a message from another session', () => {
    const result = parse([prompt({ minute: 5, extra: { origin: { kind: 'peer' } } })]);

    expect(result.prompts[0]?.askedBy).toBe('machine');
  });

  it('reads promptSource where the record names no origin', () => {
    expect(parse([prompt({ minute: 5, extra: { promptSource: 'system' } })]).prompts[0]?.askedBy).toBe('machine');
    expect(parse([prompt({ minute: 6, extra: { promptSource: 'queued' } })]).prompts[0]?.askedBy).toBe('human');
    expect(parse([prompt({ minute: 7, extra: { promptSource: 'suggestion_accepted' } })]).prompts[0]?.askedBy).toBe(
      'human',
    );
  });

  it('leaves askedBy unanswered for a log that records neither field', () => {
    expect(parse([prompt({ minute: 5 })]).prompts[0]?.askedBy).toBeUndefined();
  });

  it('keeps one copy of a prompt whose record repeats', () => {
    expect(parse([prompt({ minute: 5 }), prompt({ minute: 5 })]).prompts).toHaveLength(1);
  });
});
