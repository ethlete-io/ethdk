import { describe, expect, it } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, PinnedRow } from './model';
import { encodePeerDayRows, mapPeerDayRows, parsePeerDayRows, peerDayRowsOf } from './peer-rows';
import { reviewDay } from './review-day';
import { PeerSharedEntries, sharedEntriesOf, stampSharedEdits, withPeerSharedEntries } from './shared-rows';

const MINUTE = 60_000;
const at = (time: string) => new Date(`2026-11-17T${time}:00Z`);

const DAY = '2026-11-17';
const TANK_KEYS = { '/home/human/dev/fifa': 'gitlab.com/ethlete/fifa' };
const MAC_KEYS = { '/Users/human/dev/fifa': 'gitlab.com/ethlete/fifa' };

const MORNING = `FIFAGG-1@${at('09:00').toISOString()}`;
const NOON = `FIFAGG-2@${at('12:00').toISOString()}`;
const TANK_BAND = `unnamed:repo:/home/human/dev/fifa@${at('14:00').toISOString()}`;
const MAC_BAND = `unnamed:repo:/Users/human/dev/fifa@${at('14:00').toISOString()}`;
const SECRET_BAND = `unnamed:repo:/home/human/dev/secret-client@${at('16:00').toISOString()}`;

const proposal = (options: { issueKey: string; from: string; to: string }): WorklogProposal => {
  const observedMs = at(options.to).getTime() - at(options.from).getTime();

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: at(options.to),
    durationMs: observedMs,
    observedMs,
    description: `work on ${options.issueKey}`,
    confidence: 'certain',
    evidence: [],
    state: 'suggested',
  };
};

const dayRows = (proposals: WorklogProposal[]): DayRows => ({
  proposals,
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const ROWS = dayRows([
  proposal({ issueKey: 'FIFAGG-1', from: '09:00', to: '11:00' }),
  proposal({ issueKey: 'FIFAGG-2', from: '12:00', to: '13:00' }),
]);

const edited = (overrides: DayReviewEdits['overrides'], base: DayReviewEdits = EMPTY_DAY_REVIEW_EDITS) => ({
  ...base,
  overrides,
});

const sent = (options: { edits: DayReviewEdits; clockOffsetMs?: number }): PeerSharedEntries => {
  const parsed = parsePeerDayRows(
    encodePeerDayRows(
      peerDayRowsOf({ day: DAY, frozen: false, rows: [], ledger: [], standInNames: {}, edits: options.edits }),
    ),
  );

  if (!parsed) throw new Error('unparsable');

  const mapped = mapPeerDayRows({ rows: parsed, peerKeys: TANK_KEYS, localKeys: MAC_KEYS });

  return { entries: mapped.shared ?? [], clockOffsetMs: options.clockOffsetMs ?? 0 };
};

const built = (options: {
  id: string;
  replaces: string[];
  from: string;
  to: string;
  issueKey?: string;
}): PinnedRow => ({
  id: options.id,
  replaces: options.replaces,
  ...(options.issueKey ? { issueKey: options.issueKey } : {}),
  from: at(options.from),
  to: at(options.to),
  durationMs: at(options.to).getTime() - at(options.from).getTime(),
  observedMs: at(options.to).getTime() - at(options.from).getTime(),
  description: 'cut',
  confidence: 'certain',
  evidence: [{ kind: 'manual', at: at(options.from), detail: '/home/human/.config/token' }],
});

const cutMorning = (base: DayReviewEdits): DayReviewEdits => ({
  ...base,
  overrides: {},
  pinned: [
    built({ id: `pin:FIFAGG-1@${at('09:00').toISOString()}`, replaces: [MORNING], from: '09:00', to: '10:00' }),
    built({
      id: `pin:FIFAGG-1@${at('10:00').toISOString()}`,
      replaces: [MORNING],
      from: '10:00',
      to: '11:00',
      issueKey: 'FIFAGG-9',
    }),
  ],
});

describe('shared row edits', () => {
  it('renames, describes, decides and hides an engine row on the peer', () => {
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({
        [MORNING]: { issueKey: 'FIFAGG-7', description: 'Standings', state: 'accepted', sources: { issue: 'human' } },
        [NOON]: { hidden: true },
      }),
      atMs: 1_000,
    });

    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });

    expect(mac.overrides).toEqual(tank.overrides);
    expect(mac.stamps).toEqual({ [MORNING]: { atMs: 1_000 }, [NOON]: { atMs: 1_000 } });

    const rows = reviewDay({ rows: ROWS, edits: mac }).rows;

    expect(rows.find((row) => row.id === MORNING)).toMatchObject({ issueKey: 'FIFAGG-7', description: 'Standings' });
  });

  it('takes the later rename by the corrected clock and keeps its own on a tie', () => {
    const mac = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { issueKey: 'FIFAGG-MAC' } }),
      atMs: 5_000,
    });
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { issueKey: 'FIFAGG-TANK' } }),
      atMs: 6_000,
    });

    expect(withPeerSharedEntries({ edits: mac, peers: [sent({ edits: tank })] }).overrides[MORNING]).toEqual({
      issueKey: 'FIFAGG-TANK',
    });
    expect(withPeerSharedEntries({ edits: mac, peers: [sent({ edits: tank, clockOffsetMs: 1_000 })] })).toBe(mac);
    expect(withPeerSharedEntries({ edits: mac, peers: [sent({ edits: tank, clockOffsetMs: 2_000 })] })).toBe(mac);
  });

  it('removes a reset edit on the peer, its stand-in with it', () => {
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { description: 'Standings', standInId: 'stand-in:1:fifa' } }),
      atMs: 1_000,
    });
    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });

    expect(mac.overrides[MORNING]?.standInId).toBe('stand-in:1:fifa');

    const reset = stampSharedEdits({ before: tank, after: edited({}, tank), atMs: 2_000 });

    expect(sharedEntriesOf(reset)).toEqual([{ id: MORNING, atMs: 2_000, kind: 'deleted' }]);

    const after = withPeerSharedEntries({ edits: mac, peers: [sent({ edits: reset })] });

    expect(after.overrides).toEqual({});
    expect(after.stamps?.[MORNING]).toEqual({ atMs: 2_000, deleted: true });
    expect(withPeerSharedEntries({ edits: after, peers: [sent({ edits: tank })] })).toBe(after);
  });

  it('never re-stamps an echo of an edit it already holds', () => {
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { issueKey: 'FIFAGG-7' } }),
      atMs: 1_000,
    });
    const mac = withPeerSharedEntries({
      edits: EMPTY_DAY_REVIEW_EDITS,
      peers: [sent({ edits: tank, clockOffsetMs: 300 })],
    });

    expect(withPeerSharedEntries({ edits: tank, peers: [sent({ edits: mac, clockOffsetMs: -300 })] })).toBe(tank);
    expect(stampSharedEdits({ before: mac, after: { ...mac }, atMs: 9_000 }).stamps).toEqual(mac.stamps);
  });

  it('sends a cut as the rows it built, with no evidence, and drops the edit the cut replaced', () => {
    const before = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { description: 'whole morning' } }),
      atMs: 1_000,
    });
    const tank = stampSharedEdits({ before, after: cutMorning(before), atMs: 2_000 });
    const wire = encodePeerDayRows(
      peerDayRowsOf({ day: DAY, frozen: false, rows: [], ledger: [], standInNames: {}, edits: tank }),
    );

    expect(wire).not.toContain('evidence');
    expect(wire).not.toContain('.config');

    const macHeld = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: before })] });
    const mac = withPeerSharedEntries({ edits: macHeld, peers: [sent({ edits: tank })] });

    expect(mac.overrides).toEqual({});
    expect(mac.pinned.map((row) => ({ id: row.id, replaces: row.replaces, evidence: row.evidence }))).toEqual([
      { id: `pin:FIFAGG-1@${at('09:00').toISOString()}`, replaces: [MORNING], evidence: [] },
      { id: `pin:FIFAGG-1@${at('10:00').toISOString()}`, replaces: [MORNING], evidence: [] },
    ]);
    expect(
      reviewDay({ rows: ROWS, edits: mac }).rows.map((row) => `${row.issueKey ?? '-'} ${row.durationMs / MINUTE}`),
    ).toEqual(['- 60', 'FIFAGG-9 60', 'FIFAGG-2 60']);
  });

  it('applies the part of a merge that resolves here and skips engine rows it cannot place', () => {
    const merged = built({
      id: `pin:FIFAGG-1@${at('09:00').toISOString()}`,
      replaces: [MORNING, TANK_BAND, SECRET_BAND, 'FIFAGG-404@2026-11-17T07:00:00.000Z'],
      from: '09:00',
      to: '13:00',
      issueKey: 'FIFAGG-1',
    });
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: { ...EMPTY_DAY_REVIEW_EDITS, pinned: [merged] },
      atMs: 1_000,
    });

    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });

    expect(mac.pinned[0]?.replaces).toEqual([MORNING, MAC_BAND, 'FIFAGG-404@2026-11-17T07:00:00.000Z']);
    expect(JSON.stringify(mac)).not.toContain('/home/human');
    expect(reviewDay({ rows: ROWS, edits: mac }).rows.map((row) => row.id)).toEqual([merged.id, NOON]);

    const nowhere = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: { ...EMPTY_DAY_REVIEW_EDITS, pinned: [{ ...merged, replaces: [SECRET_BAND] }] },
      atMs: 1_000,
    });

    expect(withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: nowhere })] })).toBe(
      EMPTY_DAY_REVIEW_EDITS,
    );
  });

  it('moves an edit of a band onto the same checkout here, and drops one of a checkout it does not have', () => {
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({
        [TANK_BAND]: { issueKey: 'FIFAGG-3', laneKey: 'repo:/home/human/dev/fifa' },
        [SECRET_BAND]: { issueKey: 'SECRET-1', laneKey: 'repo:/home/human/dev/secret-client' },
      }),
      atMs: 1_000,
    });

    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });

    expect(mac.overrides).toEqual({ [MAC_BAND]: { issueKey: 'FIFAGG-3', laneKey: 'repo:/Users/human/dev/fifa' } });
    expect(JSON.stringify(mac)).not.toContain('/home/human');
  });

  it('sends a stand-in naming by its id, and a later peer naming replaces the local one', () => {
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { standInId: 'stand-in:1:fifa', description: 'Standings' } }),
      atMs: 1_000,
    });
    const changed = edited({ [MORNING]: { standInId: 'stand-in:2:fifa', description: 'Standings' } }, tank);

    expect(stampSharedEdits({ before: tank, after: changed, atMs: 2_000 }).stamps?.[MORNING]).toEqual({ atMs: 2_000 });

    const mac: DayReviewEdits = {
      ...EMPTY_DAY_REVIEW_EDITS,
      overrides: { [MORNING]: { standInId: 'stand-in:mac' } },
      stamps: { [MORNING]: { atMs: 500 } },
    };

    expect(withPeerSharedEntries({ edits: mac, peers: [sent({ edits: tank })] }).overrides[MORNING]).toEqual({
      standInId: 'stand-in:1:fifa',
      description: 'Standings',
    });
  });

  it('takes a later cut of the same engine row over its own, and keeps its own when it is later', () => {
    const macCut: DayReviewEdits = {
      ...EMPTY_DAY_REVIEW_EDITS,
      pinned: [built({ id: 'pin:mac', replaces: [MORNING], from: '09:00', to: '11:00', issueKey: 'FIFAGG-MAC' })],
      stamps: { 'pin:mac': { atMs: 3_000 } },
    };
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: cutMorning(EMPTY_DAY_REVIEW_EDITS),
      atMs: 4_000,
    });

    const later = withPeerSharedEntries({ edits: macCut, peers: [sent({ edits: tank })] });

    expect(later.pinned.map((row) => row.id)).toEqual([
      `pin:FIFAGG-1@${at('09:00').toISOString()}`,
      `pin:FIFAGG-1@${at('10:00').toISOString()}`,
    ]);
    expect(later.stamps?.['pin:mac']).toEqual({ atMs: 4_000, deleted: true });

    expect(withPeerSharedEntries({ edits: macCut, peers: [sent({ edits: tank, clockOffsetMs: 2_000 })] })).toBe(macCut);
  });

  it('carries the stand-in of a built row, so the peer version replaces a local stand-in', () => {
    const cut = cutMorning(EMPTY_DAY_REVIEW_EDITS);
    const named = {
      ...cut,
      pinned: cut.pinned.map((row, index) => (index ? row : { ...row, standInId: 'stand-in:1:fifa' })),
    };
    const tank = stampSharedEdits({ before: EMPTY_DAY_REVIEW_EDITS, after: named, atMs: 1_000 });
    const mac = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent({ edits: tank })] });

    expect(mac.pinned.map((row) => row.standInId)).toEqual(['stand-in:1:fifa', undefined]);

    const macRenamed: DayReviewEdits = {
      ...mac,
      pinned: mac.pinned.map((row) => ({ ...row, standInId: 'stand-in:mac' })),
    };
    const unnamed = stampSharedEdits({ before: tank, after: cutMorning(tank), atMs: 9_000 });
    const after = withPeerSharedEntries({ edits: macRenamed, peers: [sent({ edits: unnamed })] });

    expect(after.pinned.map((row) => row.standInId)).toEqual([undefined, 'stand-in:mac']);
  });

  it('never re-cuts a day booked here: a peer edit lands on the frozen rows', () => {
    const fresh = dayRows([proposal({ issueKey: 'FIFAGG-1', from: '09:00', to: '12:30' })]);
    const booked: DayReviewEdits = { ...EMPTY_DAY_REVIEW_EDITS, frozenRows: ROWS };
    const tank = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: edited({ [MORNING]: { description: 'Standings' } }),
      atMs: 1_000,
    });

    const mac = withPeerSharedEntries({ edits: booked, peers: [sent({ edits: tank })] });

    expect(mac.frozenRows).toBe(ROWS);
    expect(
      reviewDay({ rows: fresh, edits: mac }).rows.map((row) => ({
        id: row.id,
        minutes: row.durationMs / MINUTE,
        description: row.description,
      })),
    ).toEqual([
      { id: MORNING, minutes: 120, description: 'Standings' },
      { id: NOON, minutes: 60, description: 'work on FIFAGG-2' },
    ]);
  });
});
