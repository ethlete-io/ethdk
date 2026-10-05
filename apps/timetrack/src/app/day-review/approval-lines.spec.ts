import { AgentApproval } from '@ethlete/timetrack';
import { approvalLinesOf } from './approval-lines';

const createOf = (parentKey?: string) =>
  ({
    id: 'a1',
    client: 'CLI',
    askedAtMs: Date.UTC(2026, 0, 5, 9),
    state: 'waiting',
    request: { op: 'jira.create', summary: 'New thing', projectKey: 'FIFAGG', parentKey },
  }) as unknown as AgentApproval;

const parentOf = (item: AgentApproval, summaryOf?: (key: string) => string | undefined) =>
  approvalLinesOf(item, summaryOf).find((line) => line.label === 'Parent')?.value;

describe('approvalLinesOf parent', () => {
  it('names the parent by its key and summary when the summary is known', () => {
    expect(parentOf(createOf('FIFAGG-12605'), () => 'Finals 2026')).toBe('FIFAGG-12605 Finals 2026');
  });

  it('shows the key alone while the summary is not known', () => {
    expect(parentOf(createOf('FIFAGG-12605'), () => undefined)).toBe('FIFAGG-12605');
    expect(parentOf(createOf('FIFAGG-12605'))).toBe('FIFAGG-12605');
  });

  it('has no parent line without a parent key', () => {
    expect(parentOf(createOf())).toBeUndefined();
  });
});
