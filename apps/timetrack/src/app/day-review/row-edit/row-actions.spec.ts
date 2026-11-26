import { ReviewedRow } from '@ethlete/timetrack';
import { ROW_ACTIONS, RowActionContext, rowActionsFor } from './row-actions';

const rowOf = (overrides: Partial<ReviewedRow>) =>
  ({
    id: 'row-1',
    from: new Date('2026-01-05T09:00:00Z'),
    to: new Date('2026-01-05T10:00:00Z'),
    durationMs: 3_600_000,
    observedMs: 3_600_000,
    description: '',
    confidence: 'weak',
    state: 'suggested',
    evidence: [],
    edited: false,
    hidden: false,
    ...overrides,
  }) as ReviewedRow;

const reset = ROW_ACTIONS.find((action) => action.label === 'Reset to the proposal');
const resetOffered = (row: ReviewedRow) => reset?.enabled({ row } as RowActionContext);

describe('Reset to the proposal', () => {
  it('is offered on a row whose only change is a description auto mode wrote', () => {
    expect(resetOffered(rowOf({ sources: { description: 'auto' } }))).toBe(true);
  });

  it('is not offered on a row nothing changed', () => {
    expect(resetOffered(rowOf({}))).toBe(false);
  });
});

describe('a worklog no booked row carries', () => {
  it('offers nothing that changes the row', () => {
    const row = rowOf({ issueKey: 'ET-772', state: 'synced', worklogIds: ['w-9'] });

    expect(rowActionsFor({ row, rows: [row] } as unknown as RowActionContext).map((action) => action.label)).toEqual([
      'Copy as anonymous report',
    ]);
  });
});
