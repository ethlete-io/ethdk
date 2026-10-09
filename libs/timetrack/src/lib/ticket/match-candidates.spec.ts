import { describe, expect, it } from 'vitest';
import { JiraIssue } from '../jira/issue';
import { epicKeysOfIssues, ticketMatchCandidates } from './match-candidates';

const issue = (key: string, extra: Partial<JiraIssue> = {}): JiraIssue => ({
  key,
  id: key,
  summary: `Summary of ${key}`,
  issueType: 'Story',
  ...extra,
});

const keysOf = (issues: readonly JiraIssue[]) => issues.map((entry) => entry.key);

describe('ticketMatchCandidates', () => {
  it('puts the epic children first and marks them, ahead of a project list they fell out of', () => {
    const open = Array.from({ length: 100 }, (_, index) => issue(`FIFAGG-${20000 + index}`));
    const candidates = ticketMatchCandidates({
      projectKey: 'FIFAGG',
      epic: [issue('FIFAGG-12704', { parentKey: 'FIFAGG-12601', parentSummary: 'Rewards' })],
      open,
      logged: [],
    });

    expect(candidates[0]).toEqual(expect.objectContaining({ key: 'FIFAGG-12704', inEpic: true }));
    expect(candidates).toHaveLength(100);
    expect(candidates.filter((entry) => entry.inEpic)).toHaveLength(1);
  });

  it('caps the epic children at 50 and the two lists at 100 together', () => {
    const epic = Array.from({ length: 70 }, (_, index) => issue(`FIFAGG-${index + 1}`));
    const open = Array.from({ length: 100 }, (_, index) => issue(`FIFAGG-${1000 + index}`));
    const candidates = ticketMatchCandidates({ projectKey: 'FIFAGG', epic, open, logged: [issue('FIFAGG-5000')] });

    expect(candidates.filter((entry) => entry.inEpic)).toHaveLength(50);
    expect(candidates).toHaveLength(101);
    expect(candidates.at(-1)?.key).toBe('FIFAGG-5000');
  });

  it('lists each key once, and drops sub-tasks and epic children of another project', () => {
    const candidates = ticketMatchCandidates({
      projectKey: 'FIFAGG',
      epic: [issue('FIFAGG-1'), issue('OTHER-2'), issue('FIFAGG-3', { isSubtask: true })],
      open: [issue('FIFAGG-1'), issue('FIFAGG-4'), issue('FIFAGG-5', { isSubtask: true })],
      logged: [issue('FIFAGG-4'), issue('FIFAGG-6')],
    });

    expect(keysOf(candidates)).toEqual(['FIFAGG-1', 'FIFAGG-4', 'FIFAGG-6']);
    expect(candidates[1]?.inEpic).toBeUndefined();
  });
});

describe('epicKeysOfIssues', () => {
  it('names the parent of each issue once, never the parent of a sub-task', () => {
    expect(
      epicKeysOfIssues([
        issue('FIFAGG-1', { parentKey: 'FIFAGG-12601' }),
        issue('FIFAGG-2', { parentKey: 'fifagg-12601' }),
        issue('FIFAGG-3', { parentKey: 'FIFAGG-1', isSubtask: true }),
        issue('FIFAGG-4'),
      ]),
    ).toEqual(['FIFAGG-12601']);
  });
});
