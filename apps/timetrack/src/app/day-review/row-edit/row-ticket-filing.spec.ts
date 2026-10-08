import { ReviewedRow, UnnamedContext } from '@ethlete/timetrack';
import { rowTicketFiling } from './row-ticket-filing';

const CONTEXT = { id: 'repo:/a#feature/pdf', context: { repoPath: '/a', branch: 'feature/pdf' } } as UnnamedContext;

const rowOf = (overrides: Partial<ReviewedRow> = {}) =>
  ({ id: 'row-1', state: 'pending', evidence: [], hidden: false, ...overrides }) as ReviewedRow;

const filingFor = (open = vi.fn()) =>
  rowTicketFiling({
    store: { unnamed: () => [CONTEXT] } as never,
    autoMode: {
      reaskSubjectOf: (row: ReviewedRow) => (row.unattended ? null : { kind: 'context', contextId: CONTEXT.id }),
    } as never,
    open,
  });

describe('filing a ticket for a band', () => {
  it('finds the context behind a band that is not yet named', () => {
    expect(filingFor().contextOf(rowOf())).toBe(CONTEXT);
  });

  it('opens the form on that context', () => {
    const open = vi.fn();

    filingFor(open).file(rowOf());

    expect(open).toHaveBeenCalledWith(CONTEXT);
  });

  it('offers nothing on a band that names an issue, a stand-in or a refusal', () => {
    const filing = filingFor();

    expect(filing.contextOf(rowOf({ issueKey: 'ABC-1' }))).toBeNull();
    expect(filing.contextOf(rowOf({ standInId: 'stand-in-1' }))).toBeNull();
    expect(filing.contextOf(rowOf({ state: 'rejected' }))).toBeNull();
    expect(filing.contextOf(rowOf({ unattended: true }))).toBeNull();
  });
});
