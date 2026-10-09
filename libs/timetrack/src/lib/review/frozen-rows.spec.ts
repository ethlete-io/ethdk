import { describe, expect, it } from 'vitest';
import { SyncedWorklog, WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { setRowDescription } from './edits';
import { changedAfterBooking, frozenDayPeerBands, isDayHeldByTempo, withFrozenRows } from './frozen-rows';
import { EMPTY_DAY_REVIEW_EDITS } from './model';
import { PeerDayRows } from './peer-rows';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const at = (time: string) => new Date(`2026-10-01T${time}:00Z`);

const proposal = (options: { issueKey: string; from: string; to: string; laneKey?: string }): WorklogProposal => {
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
    ...(options.laneKey ? { laneKey: options.laneKey } : {}),
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

const LEDGER: SyncedWorklog[] = [
  {
    proposalId: 'ABC-1@2026-10-01T18:15:00.000Z',
    day: '2026-10-01',
    tempoWorklogId: 'w-1',
    contentHash: 'h',
    syncedAt: at('20:00'),
  },
];

const booked = dayRows([proposal({ issueKey: 'ABC-1', from: '18:15', to: '19:45' })]);
const recut = dayRows([
  proposal({ issueKey: 'ABC-2', from: '18:15', to: '19:15' }),
  proposal({ issueKey: 'ABC-1', from: '19:15', to: '19:45' }),
]);

const describedOn = (rows: DayRows) => {
  const [row] = reviewDay({ rows }).rows;

  if (!row) throw new Error('the day holds no row');

  return setRowDescription({ edits: EMPTY_DAY_REVIEW_EDITS, row, description: 'Bracket review' });
};

const spans = (rows: DayRows, edits = EMPTY_DAY_REVIEW_EDITS) =>
  reviewDay({ rows, edits }).rows.map((row) => ({
    issueKey: row.issueKey,
    from: row.from.toISOString().slice(11, 16),
    to: row.to.toISOString().slice(11, 16),
    description: row.description,
  }));

describe('a day Tempo holds', () => {
  it('keeps the rows and the edit it was booked with when the model re-cuts the day', () => {
    const frozen = withFrozenRows({ edits: describedOn(booked), rows: booked, ledger: LEDGER, finished: true });

    expect(frozen).not.toBeNull();
    expect(spans(recut, frozen ?? undefined)).toEqual([
      { issueKey: 'ABC-1', from: '18:15', to: '19:45', description: 'Bracket review' },
    ]);
  });

  it('freezes nothing on a day Tempo does not hold, one still running, or one already frozen', () => {
    const edits = describedOn(booked);

    expect(withFrozenRows({ edits, rows: booked, ledger: [], finished: true })).toBeNull();
    expect(withFrozenRows({ edits, rows: booked, ledger: LEDGER, finished: false })).toBeNull();
    expect(
      withFrozenRows({ edits: { ...edits, frozenRows: booked }, rows: recut, ledger: LEDGER, finished: true }),
    ).toBeNull();
  });

  it('re-cuts a day with no frozen rows', () => {
    expect(spans(recut).map((row) => row.from)).toEqual(['18:15', '19:15']);
  });

  it('counts a worklog this app wrote and one the coverage read as held', () => {
    expect(isDayHeldByTempo({ ledger: [], coverage: null })).toBe(false);
    expect(isDayHeldByTempo({ ledger: [], coverage: { issues: [] } })).toBe(false);
    expect(isDayHeldByTempo({ ledger: [], coverage: { issues: [{ issueKey: 'ABC-1', coveredMs: MINUTE }] } })).toBe(
      true,
    );
    expect(
      isDayHeldByTempo({
        ledger: [{ proposalId: 'p', day: '2026-10-01', tempoWorklogId: '1', contentHash: 'h', syncedAt: new Date() }],
        coverage: null,
      }),
    ).toBe(true);
  });
});

const window = (from: string, to: string) => ({ from: at(from), to: at(to) });

describe('a frozen day a paired machine worked on', () => {
  const SDK = 'repo:/home/tom/dev/ethlete-sdk';
  const FUT = 'repo:/home/tom/dev/fut-frontend';
  const frozen = dayRows([proposal({ issueKey: 'ET-1', from: '18:15', to: '19:45', laneKey: SDK })]);
  const current = dayRows([
    proposal({ issueKey: 'FUT-1', from: '13:15', to: '15:00', laneKey: FUT }),
    proposal({ issueKey: 'FUT-2', from: '15:00', to: '18:00', laneKey: FUT }),
    proposal({ issueKey: 'ET-1', from: '18:15', to: '19:45', laneKey: SDK }),
  ]);
  const peerLanes = {
    'mac-id': {
      [FUT]: [window('13:15', '15:00'), window('15:00', '18:00')],
      [SDK]: [window('18:30', '19:00'), window('19:45', '19:48')],
    },
  };
  const bandsOf = (foreignIssues: string[]) =>
    frozenDayPeerBands({
      frozen,
      current: { rows: current, peerLanes },
      machineNames: { 'mac-id': 'MacBook' },
      foreignIssues,
    });

  it('draws the paired machine’s work the frozen rows do not hold, as booked where Tempo holds its issue', () => {
    expect(bandsOf(['FUT-2'])).toEqual([
      { ...window('13:15', '18:00'), machineId: 'mac-id', machineName: 'MacBook', laneKey: FUT, booked: true },
    ]);
  });

  it('draws it as worked on where Tempo holds none of its issues', () => {
    expect(bandsOf(['ET-1']).map((band) => band.booked)).toEqual([false]);
  });

  it('reads a day whose read gained a lane as changed, and a renamed band or a sliver as not', () => {
    expect(changedAfterBooking({ frozen, current })).toBe(true);
    expect(
      changedAfterBooking({
        frozen,
        current: dayRows([proposal({ issueKey: 'ET-2', from: '18:15', to: '19:55', laneKey: SDK })]),
      }),
    ).toBe(false);
    expect(changedAfterBooking({ frozen, current: frozen })).toBe(false);
  });

  it('reads time a paired machine accounts for as no change, and this machine’s own new time as one', () => {
    const fragments = {
      'mac-id': { [FUT]: [window('13:20', '13:50'), window('14:30', '17:55')] },
    };

    expect(changedAfterBooking({ frozen, current, peerLanes: fragments })).toBe(false);
    expect(
      changedAfterBooking({
        frozen,
        current: dayRows([
          ...current.proposals,
          proposal({ issueKey: 'ET-3', from: '20:00', to: '20:30', laneKey: SDK }),
        ]),
        peerLanes: fragments,
      }),
    ).toBe(true);
  });

  it('draws a raw band only in a repository lane', () => {
    const bands = frozenDayPeerBands({
      frozen,
      current: { rows: current, peerLanes: { 'mac-id': { 'app:com.apple.loginwindow': [window('12:00', '13:00')] } } },
      machineNames: { 'mac-id': 'MacBook' },
      foreignIssues: [],
    });

    expect(bands).toEqual([]);
  });
});

describe('a frozen day a paired machine sent its rows for', () => {
  const FUT = 'repo:/home/tom/dev/fut-frontend';
  const frozen = dayRows([]);
  const sent: PeerDayRows = {
    day: '2026-10-01',
    frozen: true,
    rows: [
      {
        laneKey: FUT,
        from: at('13:15'),
        to: at('15:00'),
        issueKey: 'FUT-1',
        description: 'a',
        state: 'booked',
        worklogId: '7',
      },
      {
        laneKey: FUT,
        from: at('15:00'),
        to: at('16:00'),
        standInName: 'Bracket spike',
        description: '',
        state: 'suggested',
      },
      { laneKey: 'app:com.google.Chrome', from: at('16:00'), to: at('17:00'), description: '', state: 'suggested' },
    ],
  };
  const fragments = {
    'mac-id': { [FUT]: [window('13:20', '13:50')], 'app:com.google.Chrome': [window('16:00', '17:00')] },
  };

  it('draws each row as sent, in its lane, booked or named, and no application lane', () => {
    expect(
      frozenDayPeerBands({
        frozen,
        current: { rows: frozen, peerLanes: fragments },
        peerRows: { 'mac-id': sent },
        machineNames: { 'mac-id': 'MacBook' },
        foreignIssues: [],
      }),
    ).toEqual([
      {
        from: at('13:15'),
        to: at('15:00'),
        machineId: 'mac-id',
        machineName: 'MacBook',
        laneKey: FUT,
        booked: true,
        name: 'FUT-1',
      },
      {
        from: at('15:00'),
        to: at('16:00'),
        machineId: 'mac-id',
        machineName: 'MacBook',
        laneKey: FUT,
        booked: false,
        name: 'Bracket spike',
      },
    ]);
  });

  it('reads the time of the rows it sent as no change', () => {
    const current = dayRows([proposal({ issueKey: 'FUT-1', from: '13:15', to: '16:00', laneKey: FUT })]);

    expect(changedAfterBooking({ frozen, current, peerRows: { 'mac-id': sent } })).toBe(false);
    expect(changedAfterBooking({ frozen, current })).toBe(true);
  });
});
