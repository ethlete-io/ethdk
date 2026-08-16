import { describe, expect, it } from 'vitest';
import { EditorHeartbeatEvent } from '../model/event';
import { IngestedRecord } from './model';
import { DEFAULT_MAX_AHEAD_MS, DEFAULT_MAX_BEHIND_MS, parseIngestedRecords, rejectedCount } from './parse';

const NOW = new Date(2026, 7, 16, 14, 0, 0);

const record = (overrides: Partial<IngestedRecord> = {}): IngestedRecord => ({
  reporter: 'vscode',
  atMs: NOW.getTime() - 1_000,
  kind: 'editor-heartbeat',
  payload: { repoPath: '/home/tom/dev/fut-frontend', branch: 'feat/FIP-2177-user-management', editing: true },
  ...overrides,
});

const parse = (records: IngestedRecord[]) => parseIngestedRecords({ records, now: NOW });

describe('parseIngestedRecords', () => {
  it('turns a posted heartbeat into an editor event', () => {
    const { events, rejected } = parse([
      record({
        payload: { repoPath: '/home/tom/dev/x', branch: 'next', directory: 'libs', language: 'ts', editing: true },
      }),
    ]);

    expect(events).toEqual([
      {
        at: new Date(NOW.getTime() - 1_000),
        source: 'editor',
        kind: 'editor-heartbeat',
        reporter: 'vscode',
        repoPath: '/home/tom/dev/x',
        branch: 'next',
        directory: 'libs',
        language: 'ts',
        editing: true,
      } satisfies EditorHeartbeatEvent,
    ]);
    expect(rejectedCount(rejected)).toBe(0);
  });

  it('reads a missing editing flag as reading rather than editing', () => {
    expect(
      (parse([record({ payload: { repoPath: '/home/tom/dev/x' } })]).events[0] as EditorHeartbeatEvent).editing,
    ).toBe(false);
  });

  it('drops a blank field instead of storing an empty string', () => {
    const event = parse([record({ payload: { repoPath: '/home/tom/dev/x', branch: '   ', language: '' } })])
      .events[0] as EditorHeartbeatEvent;

    expect(event.branch).toBeUndefined();
    expect(event.language).toBeUndefined();
  });

  it('refuses a heartbeat that names neither a checkout nor a directory', () => {
    const { events, rejected } = parse([record({ payload: { editing: true } })]);

    expect(events).toEqual([]);
    expect(rejected.malformed).toBe(1);
  });

  it('counts a kind it does not know rather than storing it', () => {
    const { events, rejected } = parse([record({ kind: 'browser-tab' })]);

    expect(events).toEqual([]);
    expect(rejected['unknown-kind']).toBe(1);
  });

  it('refuses an instant further ahead than two clocks can drift', () => {
    const ahead = record({ atMs: NOW.getTime() + DEFAULT_MAX_AHEAD_MS + 1 });

    expect(parse([ahead]).rejected['bad-timestamp']).toBe(1);
  });

  it('takes an instant a reporter held while the app was closed', () => {
    const held = record({ atMs: NOW.getTime() - 20 * 60_000 });

    expect(parse([held]).events).toHaveLength(1);
  });

  it('refuses an instant older than a reporter could honestly be holding', () => {
    const stale = record({ atMs: NOW.getTime() - DEFAULT_MAX_BEHIND_MS - 1 });

    expect(parse([stale]).rejected['bad-timestamp']).toBe(1);
  });

  it('refuses a timestamp that is not a number at all', () => {
    expect(parse([record({ atMs: Number.NaN })]).rejected['bad-timestamp']).toBe(1);
  });

  it('keeps the good records of a batch that also carries bad ones', () => {
    const { events, rejected } = parse([record(), record({ kind: 'browser-tab' }), record()]);

    expect(events).toHaveLength(2);
    expect(rejectedCount(rejected)).toBe(1);
  });
});
