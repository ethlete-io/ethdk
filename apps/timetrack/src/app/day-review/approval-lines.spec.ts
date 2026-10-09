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

describe('approvalLinesOf stand-in resolve', () => {
  const resolveOf = (request: Record<string, unknown>) =>
    ({
      id: 'a2',
      client: 'Claude Code',
      askedAtMs: Date.UTC(2026, 0, 5, 9),
      state: 'queued',
      request: { op: 'standIn.resolve', id: 's1', ...request },
    }) as unknown as AgentApproval;

  const ticketOf = (item: AgentApproval, summaryOf?: (key: string) => string | undefined) =>
    approvalLinesOf(item, summaryOf).find((line) => line.label === 'Ticket')?.value;

  it('shows the stand-in, the issue it leaves and the new key with its summary', () => {
    const item = resolveOf({
      issueKey: 'FIFAGG-12624',
      name: 'Bracket challenge',
      fromIssueKey: 'FIFAGG-12605',
      summary: 'Umsetzung',
    });

    expect(ticketOf(item)).toBe('Bracket challenge: FIFAGG-12605 → FIFAGG-12624 Umsetzung');
  });

  it('reads the summary from the catalog when the item stored none', () => {
    const item = resolveOf({ issueKey: 'ABC-7', name: 'Pdf export' });

    expect(ticketOf(item, () => 'Export')).toBe('Pdf export: ABC-7 Export');
    expect(ticketOf(item)).toBe('Pdf export: ABC-7');
  });
});

describe('an auto mode match only the issue list named', () => {
  const applyOf = (request: Record<string, unknown>) =>
    ({
      id: 'a2',
      client: 'auto mode',
      askedAtMs: Date.UTC(2026, 0, 5, 9),
      state: 'waiting',
      request: {
        op: 'autoMode.apply',
        day: '2026-01-05',
        subject: { kind: 'stand-in', standInId: 's1' },
        label: 'Reward',
        issueKey: 'FIFAGG-12704',
        ...request,
      },
    }) as unknown as AgentApproval;

  it('shows the issue summary it found and why', () => {
    const lines = approvalLinesOf(
      applyOf({ listOnly: true, summary: 'Reward pass claim flow', reason: "Commits mention 'reward pass'." }),
    );

    expect(lines.find((line) => line.label === 'Ticket')?.value).toBe('Reward → FIFAGG-12704 Reward pass claim flow');
    expect(lines.find((line) => line.label === 'Why')?.value).toBe("Commits mention 'reward pass'.");
  });

  it('shows no reason line where auto mode gave none', () => {
    expect(approvalLinesOf(applyOf({})).map((line) => line.label)).toEqual(['Ticket', 'Asked by']);
  });
});
