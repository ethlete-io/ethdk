import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AgentLogBackfill, backfillAgentLogs$ } from './backfill';
import { parseClaudeCodeSessionLog } from './claude-code';
import { AgentSessionCursor } from './collect';
import { AgentSessionLogReader, AgentSessionLogRef } from './ports';

type Log = { ref: AgentSessionLogRef; lines: string[] };

const MODIFIED_AT = new Date(Date.UTC(2026, 7, 11, 9, 30));

const ref = (id: string, modifiedAt = MODIFIED_AT): AgentSessionLogRef => ({
  id,
  path: `/Users/tom/.claude/projects/-Users-tom-dev-ethlete-sdk/${id}.jsonl`,
  modifiedAt,
});

const turn = (options: { timestamp: string; id: string; sessionId?: string; cwd?: string }) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: options.timestamp,
    sessionId: options.sessionId ?? 's1',
    cwd: options.cwd ?? '/Users/tom/dev/ethlete-sdk',
    gitBranch: 'next',
    message: {
      id: options.id,
      model: 'claude-opus-5',
      usage: { input_tokens: 1, output_tokens: 10, cache_read_input_tokens: 500 },
    },
  });

/** Mirrors the host: a read is capped, so a long log needs several of them to reach its end. */
const readerFor = (logs: Log[], maxLines = 100) => {
  const reads: { id: string; fromLine: number }[] = [];
  const reader: AgentSessionLogReader = {
    logs$: vi.fn(() => of(logs.map((log) => log.ref))),
    readLines$: vi.fn((options: { ref: AgentSessionLogRef; fromLine: number }) => {
      reads.push({ id: options.ref.id, fromLine: options.fromLine });
      const all = logs.find((log) => log.ref.id === options.ref.id)?.lines ?? [];
      const lines = all.slice(options.fromLine, options.fromLine + maxLines);

      return of({ lines, nextLine: options.fromLine + lines.length });
    }),
  };

  return { reader, reads };
};

const backfill = (options: { logs: Log[]; cursors?: AgentSessionCursor[]; logsPerRun?: number; maxLines?: number }) => {
  const { reader, reads } = readerFor(options.logs, options.maxLines);
  const seen = vi.fn();

  backfillAgentLogs$({
    parser: parseClaudeCodeSessionLog,
    reader,
    cursors: options.cursors ?? [],
    logsPerRun: options.logsPerRun,
    parsing: { sampleIntervalMs: 0 },
  }).subscribe(seen);

  return { result: seen.mock.calls[0]?.[0] as AgentLogBackfill, reads, reader };
};

describe('backfillAgentLogs$', () => {
  it('reads a log from the top and keeps only its spend', () => {
    const { result, reads } = backfill({
      logs: [{ ref: ref('a'), lines: [turn({ timestamp: '2026-08-11T09:00:00Z', id: 't1' })] }],
    });

    expect(reads).toEqual([
      { id: 'a', fromLine: 0 },
      { id: 'a', fromLine: 1 },
    ]);
    expect(result.usage.map((event) => event.turnId)).toEqual(['t1']);
    expect(result.usage.every((event) => event.kind === 'agent-usage')).toBe(true);
  });

  it('lists every log, so one the agent has not touched today is still reached', () => {
    const { reader } = backfill({ logs: [{ ref: ref('a'), lines: [] }] });

    expect(reader.logs$).toHaveBeenCalledWith({});
  });

  it('skips a log it has already read through', () => {
    const { result, reads } = backfill({
      logs: [{ ref: ref('a'), lines: [turn({ timestamp: '2026-08-11T09:00:00Z', id: 't1' })] }],
      cursors: [{ id: 'a', nextLine: 1, readThrough: MODIFIED_AT }],
    });

    expect(reads).toEqual([]);
    expect(result).toEqual({ usage: [], prompts: [], cursors: [], remaining: 0, unparsedLines: 0 });
  });

  it('reads a log again once a re-sync has dropped its read-through', () => {
    const { reads } = backfill({
      logs: [{ ref: ref('a'), lines: [turn({ timestamp: '2026-08-11T09:00:00Z', id: 't1' })] }],
      cursors: [{ id: 'a', nextLine: 0, cwd: '/Users/tom/dev/ethlete-sdk' }],
    });

    expect(reads[0]).toEqual({ id: 'a', fromLine: 0 });
  });

  it('reads one log to its end across several host reads', () => {
    const lines = Array.from({ length: 5 }, (_, index) =>
      turn({ timestamp: `2026-08-11T09:0${index}:00Z`, id: `t${index}` }),
    );

    const { result, reads } = backfill({ logs: [{ ref: ref('a'), lines }], maxLines: 2 });

    expect(reads.map((read) => read.fromLine)).toEqual([0, 2, 4, 5]);
    expect(result.usage.map((event) => event.turnId)).toEqual(['t0', 't1', 't2', 't3', 't4']);
    expect(result.cursors).toEqual([
      { id: 'a', nextLine: 5, readThrough: MODIFIED_AT, cwd: '/Users/tom/dev/ethlete-sdk' },
    ]);
  });

  it('marks an empty log read through, so the pass converges', () => {
    const { result } = backfill({ logs: [{ ref: ref('a'), lines: [] }] });

    expect(result.cursors).toEqual([{ id: 'a', nextLine: 0, readThrough: MODIFIED_AT }]);
    expect(result.remaining).toBe(0);
  });

  it('reads only as many logs as a run allows and reports the rest as remaining', () => {
    const logs = ['a', 'b', 'c'].map((id) => ({
      ref: ref(id),
      lines: [turn({ timestamp: '2026-08-11T09:00:00Z', id: `${id}-t1` })],
    }));

    const { result, reads } = backfill({ logs, logsPerRun: 2 });

    expect([...new Set(reads.map((read) => read.id))]).toEqual(['a', 'b']);
    expect(result.cursors.map((cursor) => cursor.id)).toEqual(['a', 'b']);
    expect(result.remaining).toBe(1);
  });

  it('reports the spend of every log it read, oldest turn first', () => {
    const logs = [
      { ref: ref('a'), lines: [turn({ timestamp: '2026-08-11T10:00:00Z', id: 't-late' })] },
      { ref: ref('b'), lines: [turn({ timestamp: '2026-08-11T08:00:00Z', id: 't-early' })] },
    ];

    const { result } = backfill({ logs });

    expect(result.usage.map((event) => event.turnId)).toEqual(['t-early', 't-late']);
  });

  it('counts the lines it could not parse', () => {
    const { result } = backfill({ logs: [{ ref: ref('a'), lines: ['not json', ''] }] });

    expect(result.unparsedLines).toBe(1);
  });

  it('takes its checkout from the last turn, so a re-sync can find the log by path', () => {
    const { result } = backfill({
      logs: [
        {
          ref: ref('a'),
          lines: [
            turn({ timestamp: '2026-08-11T09:00:00Z', id: 't1', cwd: '/Users/tom/dev/ethlete-sdk' }),
            turn({ timestamp: '2026-08-11T09:05:00Z', id: 't2', cwd: '/Users/tom/dev/fut-frontend' }),
          ],
        },
      ],
    });

    expect(result.cursors[0]?.cwd).toBe('/Users/tom/dev/fut-frontend');
  });
});
