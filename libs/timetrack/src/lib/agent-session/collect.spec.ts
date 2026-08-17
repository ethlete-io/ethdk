import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { parseClaudeCodeSessionLog } from './claude-code';
import { AgentSessionCollection, AgentSessionCursor, collectAgentSessions$ } from './collect';
import { AgentSessionLogReader, AgentSessionLogRef } from './ports';

type Log = { ref: AgentSessionLogRef; lines: string[] };

const ref = (id: string, modifiedAt = new Date(Date.UTC(2026, 7, 11, 9, 30))): AgentSessionLogRef => ({
  id,
  path: `/Users/tom/.claude/projects/-Users-tom-dev-ethlete-sdk/${id}.jsonl`,
  modifiedAt,
});

const record = (options: { timestamp: string; sessionId?: string; cwd?: string }) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: options.timestamp,
    sessionId: options.sessionId ?? 's1',
    cwd: options.cwd ?? '/Users/tom/dev/ethlete-sdk',
    gitBranch: 'next',
  });

const customTitle = (title: string) => JSON.stringify({ type: 'custom-title', sessionId: 's1', customTitle: title });

const readerFor = (logs: Log[]) => {
  const reads: { id: string; fromLine: number }[] = [];
  const reader: AgentSessionLogReader = {
    logs$: vi.fn(() => of(logs.map((log) => log.ref))),
    readLines$: vi.fn((options: { ref: AgentSessionLogRef; fromLine: number }) => {
      reads.push({ id: options.ref.id, fromLine: options.fromLine });
      const lines = logs.find((log) => log.ref.id === options.ref.id)?.lines.slice(options.fromLine) ?? [];

      return of({ lines, nextLine: options.fromLine + lines.length });
    }),
  };

  return { reader, reads };
};

const collect = (options: { logs: Log[]; cursors?: AgentSessionCursor[]; modifiedAfter?: Date }) => {
  const { reader, reads } = readerFor(options.logs);
  const seen = vi.fn();

  collectAgentSessions$({
    parser: parseClaudeCodeSessionLog,
    reader,
    cursors: options.cursors ?? [],
    modifiedAfter: options.modifiedAfter,
    parsing: { sampleIntervalMs: 0 },
  }).subscribe(seen);

  return { result: seen.mock.calls[0]?.[0] as AgentSessionCollection, reads, reader };
};

describe('collectAgentSessions$', () => {
  it('reads every log from the top on a first run and reports where it stopped', () => {
    const { result, reads } = collect({
      logs: [
        { ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:00:00.000Z' })] },
        { ref: ref('s2'), lines: [record({ timestamp: '2026-08-11T09:10:00.000Z', sessionId: 's2' })] },
      ],
    });

    expect(reads).toEqual([
      { id: 's1', fromLine: 0 },
      { id: 's2', fromLine: 0 },
    ]);
    expect(result.events).toHaveLength(2);
    expect(result.cursors).toEqual([
      {
        id: 's1',
        nextLine: 1,
        after: new Date('2026-08-11T09:00:00.000Z'),
        title: undefined,
        cwd: '/Users/tom/dev/ethlete-sdk',
      },
      {
        id: 's2',
        nextLine: 1,
        after: new Date('2026-08-11T09:10:00.000Z'),
        title: undefined,
        cwd: '/Users/tom/dev/ethlete-sdk',
      },
    ]);
  });

  it('resumes each log from its cursor line, so nothing is read twice', () => {
    const lines = [
      record({ timestamp: '2026-08-11T09:00:00.000Z' }),
      record({ timestamp: '2026-08-11T09:05:00.000Z' }),
    ];
    const { result, reads } = collect({
      logs: [{ ref: ref('s1'), lines }],
      cursors: [{ id: 's1', nextLine: 1, after: new Date('2026-08-11T09:00:00.000Z') }],
    });

    expect(reads).toEqual([{ id: 's1', fromLine: 1 }]);
    expect(result.events.map((event) => event.at.toISOString())).toEqual(['2026-08-11T09:05:00.000Z']);
    expect(result.cursors[0]?.nextLine).toBe(2);
  });

  it('drops a record the agent appended behind the cursor instant', () => {
    const lines = [
      record({ timestamp: '2026-08-11T09:05:00.000Z' }),
      record({ timestamp: '2026-08-11T09:02:00.000Z' }),
      record({ timestamp: '2026-08-11T09:07:00.000Z' }),
    ];
    const { result } = collect({
      logs: [{ ref: ref('s1'), lines }],
      cursors: [{ id: 's1', nextLine: 1, after: new Date('2026-08-11T09:05:00.000Z') }],
    });

    expect(result.events.map((event) => event.at.toISOString())).toEqual(['2026-08-11T09:07:00.000Z']);
  });

  it('keeps the cursor instant of a batch that produced no sample', () => {
    const after = new Date('2026-08-11T09:00:00.000Z');
    const { result } = collect({
      logs: [{ ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:00:00.000Z' })] }],
      cursors: [{ id: 's1', nextLine: 1, after }],
    });

    expect(result.events).toEqual([]);
    expect(result.cursors).toEqual([{ id: 's1', nextLine: 1, after, title: undefined, cwd: undefined }]);
  });

  it('records the checkout of the last sample, so a re-sync can find the log by path', () => {
    const { result } = collect({
      logs: [
        {
          ref: ref('s1'),
          lines: [record({ timestamp: '2026-08-11T09:00:00.000Z', cwd: '/Users/tom/dev/fut-frontend' })],
        },
      ],
    });

    expect(result.cursors[0]?.cwd).toBe('/Users/tom/dev/fut-frontend');
  });

  it('keeps the checkout the last run recorded when the new lines hold no sample', () => {
    const { result } = collect({
      logs: [{ ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:00:00.000Z' })] }],
      cursors: [{ id: 's1', nextLine: 1, cwd: '/Users/tom/dev/fut-frontend' }],
    });

    expect(result.cursors[0]?.cwd).toBe('/Users/tom/dev/fut-frontend');
  });

  it('takes the last checkout of a log that changed one part way through', () => {
    const { result } = collect({
      logs: [
        {
          ref: ref('s1'),
          lines: [
            record({ timestamp: '2026-08-11T09:00:00.000Z', cwd: '/Users/tom/dev/one' }),
            record({ timestamp: '2026-08-11T09:05:00.000Z', cwd: '/Users/tom/dev/two' }),
          ],
        },
      ],
    });

    expect(result.cursors[0]?.cwd).toBe('/Users/tom/dev/two');
  });

  it('carries a title the previous run resolved into a batch that holds none', () => {
    const { result } = collect({
      logs: [{ ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:05:00.000Z' })] }],
      cursors: [{ id: 's1', nextLine: 0, title: 'Add the agent session collector' }],
    });

    expect(result.events[0]?.title).toBe('Add the agent session collector');
    expect(result.cursors[0]?.title).toBe('Add the agent session collector');
  });

  it('lets a title in the new lines replace the carried one', () => {
    const { result } = collect({
      logs: [{ ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:05:00.000Z' }), customTitle('Renamed')] }],
      cursors: [{ id: 's1', nextLine: 0, title: 'Add the agent session collector' }],
    });

    expect(result.cursors[0]?.title).toBe('Renamed');
  });

  it('keeps the cursor of a log this run did not list', () => {
    const { result } = collect({
      logs: [{ ref: ref('s2'), lines: [record({ timestamp: '2026-08-11T09:00:00.000Z', sessionId: 's2' })] }],
      cursors: [{ id: 's1', nextLine: 42, title: 'Yesterday' }],
      modifiedAfter: new Date(Date.UTC(2026, 7, 11, 8)),
    });

    expect(result.cursors.map((cursor) => cursor.id)).toEqual(['s1', 's2']);
    expect(result.cursors[0]).toEqual({ id: 's1', nextLine: 42, title: 'Yesterday' });
  });

  it('passes the modified-after bound to the host', () => {
    const modifiedAfter = new Date(Date.UTC(2026, 7, 11, 8));
    const { reader } = collect({ logs: [], modifiedAfter });

    expect(reader.logs$).toHaveBeenCalledWith({ modifiedAfter });
  });

  it('emits the events of all logs in time order', () => {
    const { result } = collect({
      logs: [
        { ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:20:00.000Z' })] },
        { ref: ref('s2'), lines: [record({ timestamp: '2026-08-11T09:10:00.000Z', sessionId: 's2' })] },
      ],
    });

    expect(result.events.map((event) => event.sessionId)).toEqual(['s2', 's1']);
  });

  it('totals the unreadable lines of every log it read', () => {
    const { result } = collect({
      logs: [
        { ref: ref('s1'), lines: [record({ timestamp: '2026-08-11T09:00:00.000Z' }), '{"type":"assist'] },
        { ref: ref('s2'), lines: ['not json'] },
      ],
    });

    expect(result.unparsedLines).toBe(2);
  });

  it('emits an empty collection when the agent has never run', () => {
    const { result } = collect({ logs: [] });

    expect(result).toEqual({ events: [], cursors: [], unparsedLines: 0 });
  });
});
