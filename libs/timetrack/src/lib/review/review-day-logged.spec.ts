import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { CALL_LANE_KEY } from '../rows/lane';
import { WorklogProposal } from '../model/proposal';
import { EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const MINUTE = 60_000;
const LANE = 'repo:/home/human/dev/fifagg/fifagg-frontend';
const at = (time: string) => new Date(`2026-10-06T${time}:00Z`);

const proposal = (options: { issueKey: string; from: string; to: string; laneKey?: string }): WorklogProposal => {
  const span = at(options.to).getTime() - at(options.from).getTime();

  return {
    id: `${options.issueKey}@${at(options.from).toISOString()}`,
    issueKey: options.issueKey,
    from: at(options.from),
    to: at(options.to),
    durationMs: span,
    observedMs: span,
    laneKey: options.laneKey ?? LANE,
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

describe('reviewDay logged time', () => {
  it('counts the minutes a call shares with a code row once, as the sync writes them', () => {
    const review = reviewDay({
      rows: dayRows([
        proposal({ issueKey: 'FIFAGG-12657', from: '07:45', to: '12:00' }),
        proposal({ issueKey: 'FIFAGG-12652', from: '08:30', to: '10:00', laneKey: CALL_LANE_KEY }),
      ]),
      check: { targetMs: 240 * MINUTE },
    });

    expect(review.rows.map((row) => row.durationMs / MINUTE)).toEqual([255, 90]);
    expect(review.check.proposedMs).toBe(255 * MINUTE);
    expect(review.check.loggedMs).toBe(0);
    expect(review.check.deltaMs).toBe(15 * MINUTE);
  });

  it('logs the rows Tempo holds a worklog of and leaves the accepted ones proposed', () => {
    const booked = proposal({ issueKey: 'FIFAGG-12657', from: '08:00', to: '08:30' });
    const review = reviewDay({
      rows: dayRows([booked, proposal({ issueKey: 'FIFAGG-12652', from: '09:00', to: '18:30' })]),
      edits: {
        ...EMPTY_DAY_REVIEW_EDITS,
        booked: {
          edits: EMPTY_DAY_REVIEW_EDITS,
          written: [
            {
              proposalId: booked.id,
              worklogId: 'w1',
              issueKey: booked.issueKey,
              from: booked.from,
              durationMs: 30 * MINUTE,
              description: booked.description,
            },
          ],
        },
      },
    });

    expect(review.check.proposedMs).toBe(600 * MINUTE);
    expect(review.check.loggedMs).toBe(30 * MINUTE);
  });
});
