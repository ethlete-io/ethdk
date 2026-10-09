import { BookedDay, DayRows, EMPTY_DAY_REVIEW_EDITS, WorklogProposal } from '@ethlete/timetrack';
import { parseStoredEdits, toStoredEdits } from './review-store';

const proposal: WorklogProposal = {
  id: 'ABC-1@2026-10-01T18:15:00.000Z',
  issueKey: 'ABC-1',
  from: new Date('2026-10-01T18:15:00.000Z'),
  to: new Date('2026-10-01T19:45:00.000Z'),
  durationMs: 90 * 60_000,
  observedMs: 90 * 60_000,
  description: 'work on ABC-1',
  confidence: 'certain',
  evidence: [{ kind: 'commit', at: new Date('2026-10-01T18:30:00.000Z'), detail: 'Fix the bracket' }],
  state: 'suggested',
};

const frozenRows: DayRows = {
  proposals: [proposal],
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

describe('review store', () => {
  it('reads back the frozen rows of a booked day with their dates', () => {
    const stored = JSON.parse(JSON.stringify(toStoredEdits({ ...EMPTY_DAY_REVIEW_EDITS, frozenRows })));

    expect(parseStoredEdits(stored).frozenRows).toEqual(frozenRows);
  });

  it('reads back the review a booked day was stored with, with its dates', () => {
    const booked: BookedDay = {
      written: [
        {
          proposalId: proposal.id,
          worklogId: '7001',
          issueKey: 'ABC-1',
          from: proposal.from,
          durationMs: proposal.durationMs,
          description: proposal.description,
        },
      ],
      edits: {
        ...EMPTY_DAY_REVIEW_EDITS,
        statements: [
          {
            id: 'away-1',
            from: new Date('2026-10-01T12:00:00.000Z'),
            to: new Date('2026-10-01T12:30:00.000Z'),
            kind: 'away',
          },
        ],
      },
      review: {
        rows: [{ ...proposal, issueKey: 'ABC-1', worklogIds: ['7001'] }],
        hidden: [],
      } as unknown as BookedDay['review'],
    };
    const stored = JSON.parse(JSON.stringify(toStoredEdits({ ...EMPTY_DAY_REVIEW_EDITS, frozenRows, booked })));

    expect(parseStoredEdits(stored).booked).toEqual(booked);
  });

  it('reads a day without frozen rows as one the engine still cuts', () => {
    const stored = JSON.parse(JSON.stringify(toStoredEdits(EMPTY_DAY_REVIEW_EDITS)));

    expect(parseStoredEdits(stored).frozenRows).toBeUndefined();
  });
});
