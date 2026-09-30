import { describe, expect, it } from 'vitest';
import { diffLines, diffSnapshots, snapshotDayOf, Snapshot, SnapshotRow } from './timetrack-snapshot';

const row = (overrides: Partial<SnapshotRow> = {}): SnapshotRow => ({
  id: 'FIP-1@a',
  laneKey: 'repo:/x',
  fromMs: 1000,
  toMs: 2000,
  issueKey: 'FIP-1',
  state: 'edited',
  edited: true,
  ...overrides,
});

const snapshot = (rows: SnapshotRow[], uncommitted: string[] = []): Snapshot => ({
  takenAt: 'then',
  uncommitted,
  days: [{ day: '2026-09-29', loggedMs: 10, proposedMs: 20, rows }],
});

describe('diffSnapshots', () => {
  it('reports nothing for equal snapshots', () => {
    const diff = diffSnapshots(snapshot([row()]), snapshot([row()]));

    expect(diff.changedDays).toBe(0);
    expect(diff.changedRows).toBe(0);
  });

  it('reports a user-edited row that became a stand-in', () => {
    const diff = diffSnapshots(
      snapshot([row()]),
      snapshot([row({ issueKey: undefined, standInId: 's1', state: 'proposed', edited: false })]),
    );

    expect(diff.changedRows).toBe(1);
    expect(diff.days[0]?.changed[0]?.changes.map((change) => change.field)).toEqual([
      'issueKey',
      'standInId',
      'state',
      'edited',
    ]);
    expect(diffLines(diff).join('\n')).toContain('issueKey: FIP-1 → -');
  });

  it('reports gone and new rows', () => {
    const diff = diffSnapshots(snapshot([row()]), snapshot([row({ id: 'other', laneKey: 'lane:call' })]));

    expect(diff.days[0]?.gone.map((entry) => entry.id)).toEqual(['FIP-1@a']);
    expect(diff.days[0]?.added.map((entry) => entry.id)).toEqual(['other']);
  });

  it('matches by lane and start when the id moved', () => {
    const diff = diffSnapshots(snapshot([row()]), snapshot([row({ id: 'renamed', toMs: 3000 })]));

    expect(diff.days[0]?.gone).toEqual([]);
    expect(diff.days[0]?.changed[0]?.changes.map((change) => change.field)).toEqual(['id', 'toMs']);
  });

  it('reports changed day totals', () => {
    const after = snapshot([row()]);

    after.days[0]!.loggedMs = 99;

    expect(diffSnapshots(snapshot([row()]), after).days[0]?.totals).toEqual([{ field: 'loggedMs', from: 10, to: 99 }]);
  });

  it('flags differing uncommitted files regardless of order', () => {
    expect(diffSnapshots(snapshot([], ['a', 'b']), snapshot([], ['b', 'a'])).uncommittedDiffers).toBe(false);
    expect(diffSnapshots(snapshot([], ['a']), snapshot([], ['a', 'c'])).uncommittedDiffers).toBe(true);
  });
});

describe('snapshotDayOf', () => {
  it('keeps the named fields of visible and hidden rows only', () => {
    const day = snapshotDayOf({
      day: 'd',
      loggedMs: 1,
      proposedMs: 2,
      rows: [{ id: 'a', issueKey: 'X-1', confidence: 'certain' }],
      hidden: [{ id: 'b', hidden: true }],
    });

    expect(day.rows).toEqual([
      { id: 'a', issueKey: 'X-1' },
      { id: 'b', hidden: true },
    ]);
  });
});
