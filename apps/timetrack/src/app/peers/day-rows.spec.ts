import { EMPTY_DAY_REVIEW_EDITS, addManualRow, peerDayRowsOf, stampSharedEdits } from '@ethlete/timetrack';
import { HostReceivedRange, NOTHING_RECEIVED } from '../../host';
import { withReceivedSharedRows } from './day-rows';

const DAY = '2026-11-17';

const tankRow = (description: string, atMs: number) =>
  stampSharedEdits({
    before: EMPTY_DAY_REVIEW_EDITS,
    after: addManualRow({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: {
        issueKey: 'FIFAGG-12769',
        description,
        from: new Date('2026-11-17T13:00:00Z'),
        to: new Date('2026-11-17T15:15:00Z'),
      },
    }),
    atMs,
  });

const receivedFrom = (description: string, atMs: number, clockOffsetMs: number): HostReceivedRange => ({
  ...NOTHING_RECEIVED,
  dayRows: [
    {
      machineId: 'tank',
      clockOffsetMs,
      rows: peerDayRowsOf({
        day: DAY,
        frozen: false,
        rows: [],
        ledger: [],
        standInNames: {},
        edits: tankRow(description, atMs),
      }),
    },
  ],
});

describe('received shared rows', () => {
  it('adds the row a paired machine wrote by hand, ordered by its clock offset', () => {
    const mac = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: tankRow('Mac wording', 0),
      atMs: 5_000,
    });

    expect(
      withReceivedSharedRows({ edits: EMPTY_DAY_REVIEW_EDITS, received: receivedFrom('Tank', 1_000, 0), day: DAY })
        .pinned[0]?.description,
    ).toBe('Tank');
    expect(
      withReceivedSharedRows({ edits: mac, received: receivedFrom('Tank', 6_000, 0), day: DAY }).pinned[0],
    ).toMatchObject({ description: 'Tank' });
    expect(withReceivedSharedRows({ edits: mac, received: receivedFrom('Tank', 6_000, 2_000), day: DAY })).toBe(mac);
    expect(withReceivedSharedRows({ edits: mac, received: receivedFrom('Tank', 6_000, 0), day: '2026-11-18' })).toBe(
      mac,
    );
  });
});
