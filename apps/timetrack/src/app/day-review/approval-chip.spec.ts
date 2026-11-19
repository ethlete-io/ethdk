import { AUTO_MODE_CLIENT, AgentApproval } from '@ethlete/timetrack';
import { approvalChipOf, approvalExistingOf } from './approval-lines';

const createOf = (existing?: { issueKey: string; leads?: true }) =>
  ({
    id: 'a1',
    client: AUTO_MODE_CLIENT,
    askedAtMs: Date.UTC(2026, 10, 19, 9),
    state: 'queued',
    request: { op: 'jira.create', summary: 'Visuelle Baselines integrieren', projectKey: 'FIFAGG', existing },
  }) as unknown as AgentApproval;

describe('approvalChipOf for an auto mode create', () => {
  it('offers the existing issue beside the new one', () => {
    expect(approvalChipOf(createOf({ issueKey: 'FIFAGG-12769' }))).toBe('Auto · File FIFAGG · or FIFAGG-12769');
  });

  it('leads with the existing issue the branch already books', () => {
    expect(approvalChipOf(createOf({ issueKey: 'FIFAGG-12769', leads: true }))).toBe(
      'Auto · Keep FIFAGG-12769 · or file FIFAGG',
    );
  });

  it('shows the new issue alone without an existing one', () => {
    expect(approvalChipOf(createOf())).toBe('Auto · File FIFAGG');
    expect(approvalExistingOf(createOf())).toBeNull();
  });
});
