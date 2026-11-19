import { describe, expect, it } from 'vitest';
import { addManualRow } from './edits';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, PinnedRow } from './model';
import { encodePeerDayRows, mapPeerDayRows, parsePeerDayRows, peerDayRowsOf } from './peer-rows';
import { PeerSharedEntries, sharedEntriesOf, stampSharedEdits, withPeerSharedEntries } from './shared-rows';

const at = (time: string) => new Date(`2026-11-17T${time}:00Z`);

const DAY = '2026-11-17';
const TANK_KEYS = { '/home/human/dev/fifa': 'gitlab.com/ethlete/fifa' };
const MAC_KEYS = { '/Users/human/dev/fifa': 'gitlab.com/ethlete/fifa' };

const added = (edits: DayReviewEdits, laneKey?: string) =>
  addManualRow({
    edits,
    row: {
      issueKey: 'FIFAGG-12769',
      description: 'Review call',
      from: at('13:00'),
      to: at('15:15'),
      ...(laneKey ? { laneKey } : {}),
    },
  });

const change = (options: { before: DayReviewEdits; after: DayReviewEdits; atMs: number }) => stampSharedEdits(options);

const describeRow = (edits: DayReviewEdits, description: string): DayReviewEdits => ({
  ...edits,
  pinned: edits.pinned.map((row) => ({ ...row, description })),
});

const sent = (options: {
  edits: DayReviewEdits;
  clockOffsetMs?: number;
  peerKeys?: Record<string, string>;
  localKeys?: Record<string, string>;
}): PeerSharedEntries => {
  const parsed = parsePeerDayRows(
    encodePeerDayRows(
      peerDayRowsOf({ day: DAY, frozen: false, rows: [], ledger: [], standInNames: {}, edits: options.edits }),
    ),
  );

  if (!parsed) throw new Error('unparsable');

  const mapped = mapPeerDayRows({
    rows: parsed,
    peerKeys: options.peerKeys ?? TANK_KEYS,
    localKeys: options.localKeys ?? MAC_KEYS,
  });

  return { entries: mapped.shared ?? [], clockOffsetMs: options.clockOffsetMs ?? 0 };
};

const manualIn = (edits: DayReviewEdits) =>
  edits.pinned.map((row) => ({ id: row.id, description: row.description, laneKey: row.laneKey }));

describe('shared manual rows', () => {
  it('shows a row made on one machine on the peer, in the peer lane of the same repository', () => {
    const tank = change({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: added(EMPTY_DAY_REVIEW_EDITS, 'repo:/home/human/dev/fifa'),
      atMs: 1_000,
    });
    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });

    expect(manualIn(mac)).toEqual([
      { id: tank.pinned[0]?.id, description: 'Review call', laneKey: 'repo:/Users/human/dev/fifa' },
    ]);
    expect(mac.pinned[0]).toMatchObject({
      issueKey: 'FIFAGG-12769',
      from: at('13:00'),
      to: at('15:15'),
      replaces: [],
      confidence: 'certain',
      observedMs: 0,
      evidence: [{ kind: 'manual', at: at('13:00') }],
    });
    expect(mac.stamps).toEqual({ [tank.pinned[0]?.id ?? '']: { atMs: 1_000 } });
  });

  it('takes the later edit by the corrected clock, and keeps its own on a tie', () => {
    const tank = change({ before: EMPTY_DAY_REVIEW_EDITS, after: added(EMPTY_DAY_REVIEW_EDITS), atMs: 1_000 });
    const macCopy = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });
    const macEdit = change({ before: macCopy, after: describeRow(macCopy, 'Mac wording'), atMs: 5_000 });

    const tankLater = change({ before: tank, after: describeRow(tank, 'Tank wording'), atMs: 6_000 });

    expect(manualIn(withPeerSharedEntries({ edits: macEdit, peers: [sent({ edits: tankLater })] }))[0]).toMatchObject({
      description: 'Tank wording',
    });

    const skewed = sent({ edits: tankLater, clockOffsetMs: 2_000 });

    expect(manualIn(withPeerSharedEntries({ edits: macEdit, peers: [skewed] }))[0]).toMatchObject({
      description: 'Mac wording',
    });

    const tied = sent({ edits: tankLater, clockOffsetMs: 1_000 });

    expect(withPeerSharedEntries({ edits: macEdit, peers: [tied] })).toBe(macEdit);
    expect(manualIn(withPeerSharedEntries({ edits: tankLater, peers: [sent({ edits: macEdit })] }))[0]).toMatchObject({
      description: 'Tank wording',
    });
  });

  it('deletes on the peer, and an older copy never brings the row back', () => {
    const tank = change({ before: EMPTY_DAY_REVIEW_EDITS, after: added(EMPTY_DAY_REVIEW_EDITS), atMs: 1_000 });
    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });
    const removed = change({ before: tank, after: { ...tank, pinned: [] }, atMs: 2_000 });

    const macAfter = withPeerSharedEntries({ edits: mac, peers: [sent({ edits: removed })] });

    expect(macAfter.pinned).toEqual([]);
    expect(withPeerSharedEntries({ edits: removed, peers: [sent({ edits: mac })] })).toBe(removed);
    expect(withPeerSharedEntries({ edits: macAfter, peers: [sent({ edits: removed })] })).toBe(macAfter);
  });

  it('leaves an echo of its own row alone, so two machines never trade stamps back and forth', () => {
    const tank = change({ before: EMPTY_DAY_REVIEW_EDITS, after: added(EMPTY_DAY_REVIEW_EDITS), atMs: 1_000 });
    const mac = withPeerSharedEntries({
      edits: EMPTY_DAY_REVIEW_EDITS,
      peers: [sent({ edits: tank, clockOffsetMs: 300 })],
    });

    expect(withPeerSharedEntries({ edits: tank, peers: [sent({ edits: mac, clockOffsetMs: -400 })] })).toBe(tank);
  });

  it('never touches a pinned row it does not share, even under the same id', () => {
    const tank = change({ before: EMPTY_DAY_REVIEW_EDITS, after: added(EMPTY_DAY_REVIEW_EDITS), atMs: 1_000 });
    const engineRow: PinnedRow = {
      ...(tank.pinned[0] as PinnedRow),
      description: 'split',
      evidence: [],
    };
    const mac: DayReviewEdits = { ...EMPTY_DAY_REVIEW_EDITS, pinned: [engineRow] };

    expect(withPeerSharedEntries({ edits: mac, peers: [sent({ edits: tank })] })).toBe(mac);
  });

  it('stamps only shared subjects that changed', () => {
    const tank = change({ before: EMPTY_DAY_REVIEW_EDITS, after: added(EMPTY_DAY_REVIEW_EDITS), atMs: 1_000 });
    const same = { ...tank, overrides: { other: { standInId: 'stand-in-1' } } };

    expect(change({ before: tank, after: same, atMs: 9_000 })).toBe(same);
  });

  it('sends no machine path, stand-in or evidence detail, and drops a lane the receiver has no checkout of', () => {
    const tank = change({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: added(EMPTY_DAY_REVIEW_EDITS, 'repo:/home/human/dev/secret-client'),
      atMs: 1_000,
    });
    const withLocalOnly: DayReviewEdits = {
      ...tank,
      pinned: tank.pinned.map((row) => ({
        ...row,
        standInId: 'stand-in-1',
        evidence: [...row.evidence, { kind: 'manual', at: at('13:00'), detail: '/home/human/.config/token' }],
      })),
    };
    const wire = encodePeerDayRows(
      peerDayRowsOf({ day: DAY, frozen: false, rows: [], ledger: [], standInNames: {}, edits: withLocalOnly }),
    );

    expect(wire).not.toContain('.config');
    expect(wire).not.toContain('stand-in-1');
    expect(wire).not.toContain('evidence');

    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: withLocalOnly })] });

    expect(mac.pinned[0]?.laneKey).toBeUndefined();
    expect(JSON.stringify(mac)).not.toContain('/home/human');
  });

  it('shares a row never stamped as the oldest version', () => {
    const legacy = added(EMPTY_DAY_REVIEW_EDITS);

    expect(sharedEntriesOf(legacy)).toMatchObject([{ kind: 'manual-row', atMs: 0 }]);
  });
});
