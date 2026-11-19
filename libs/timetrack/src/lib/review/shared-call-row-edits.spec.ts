import { describe, expect, it } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { DayRows } from '../rows/build-rows';
import { CALL_LANE_KEY } from '../rows/lane';
import { EMPTY_DAY_REVIEW_EDITS } from './model';
import { encodePeerDayRows, mapPeerDayRows, parsePeerDayRows, peerDayRowsOf } from './peer-rows';
import { reviewDay } from './review-day';
import { PeerSharedEntries, stampSharedEdits, withPeerSharedEntries } from './shared-rows';

const at = (time: string) => new Date(`2026-11-17T${time}:00Z`);
const DAY = '2026-11-17';
const CALL_ID = `FIFAGG-5@${at('10:00').toISOString()}`;

const callProposal = (): WorklogProposal => ({
  id: CALL_ID,
  issueKey: 'FIFAGG-5',
  from: at('10:00'),
  to: at('11:00'),
  durationMs: 3_600_000,
  observedMs: 3_600_000,
  description: 'Standup',
  confidence: 'weak',
  evidence: [],
  state: 'suggested',
  laneKey: CALL_LANE_KEY,
});

const ROWS: DayRows = {
  proposals: [callProposal()],
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: [],
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
};

const sent = (edits: Parameters<typeof peerDayRowsOf>[0]['edits']): PeerSharedEntries => {
  const parsed = parsePeerDayRows(
    encodePeerDayRows(peerDayRowsOf({ day: DAY, frozen: false, rows: [], ledger: [], standInNames: {}, edits })),
  );

  if (!parsed) throw new Error('unparsable');

  const mapped = mapPeerDayRows({ rows: parsed, peerKeys: {}, localKeys: {} });

  return { entries: mapped.shared ?? [], clockOffsetMs: 0 };
};

describe('shared call row edits', () => {
  it('rejects and hides a call row on the peer', () => {
    const first = stampSharedEdits({
      before: EMPTY_DAY_REVIEW_EDITS,
      after: { ...EMPTY_DAY_REVIEW_EDITS, overrides: { [CALL_ID]: { state: 'rejected', hidden: true } } },
      atMs: 1_000,
    });
    const second = withPeerSharedEntries({ edits: EMPTY_DAY_REVIEW_EDITS, peers: [sent(first)] });
    const review = reviewDay({ rows: ROWS, edits: second });

    expect(review.hidden.find((row) => row.id === CALL_ID)).toMatchObject({ state: 'rejected', hidden: true });
    expect(review.rows.find((row) => row.id === CALL_ID)).toBeUndefined();
  });
});
