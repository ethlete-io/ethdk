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
  it('keeps the order it was given, marks included, and caps the list before the logged issues', () => {
    const open = Array.from({ length: 30 }, (_, index) => issue(`FIFAGG-${1000 + index}`));
    const candidates = ticketMatchCandidates({
      open: [{ ...issue('FIFAGG-12704'), inEpic: true }, ...open],
      logged: [issue('FIFAGG-5000')],
      limit: 25,
    });

    expect(candidates[0]).toEqual(expect.objectContaining({ key: 'FIFAGG-12704', inEpic: true }));
    expect(candidates).toHaveLength(26);
    expect(candidates.at(-1)?.key).toBe('FIFAGG-5000');
  });

  it('lists each key once, and drops sub-tasks', () => {
    const candidates = ticketMatchCandidates({
      open: [issue('FIFAGG-1'), issue('FIFAGG-4'), issue('FIFAGG-1'), issue('FIFAGG-5', { isSubtask: true })],
      logged: [issue('FIFAGG-4'), issue('FIFAGG-6')],
    });

    expect(keysOf(candidates)).toEqual(['FIFAGG-1', 'FIFAGG-4', 'FIFAGG-6']);
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
