import { describe, expect, it } from 'vitest';
import { toAgentApiTempoWorklog } from './tempo-worklog';

describe('toAgentApiTempoWorklog', () => {
  it('names a worklog starting at local midnight by its start time', () => {
    const answer = toAgentApiTempoWorklog(
      {
        id: '716401',
        issueId: '10',
        authorAccountId: 'me',
        from: new Date(2026, 8, 10, 0, 0),
        durationMs: 30 * 60_000,
        billableMs: 30 * 60_000,
        description: 'Late night',
        attributes: {},
      },
      new Map([['10', 'FIP-1']]),
    );

    expect(answer).toEqual(
      expect.objectContaining({ id: '716401', day: '2026-09-10', startTime: '00:00', issueKey: 'FIP-1' }),
    );
  });
});
