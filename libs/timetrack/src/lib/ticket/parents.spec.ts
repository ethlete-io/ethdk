import { describe, expect, it } from 'vitest';
import { JiraIssue } from '../jira/issue';
import { rankParentCandidates, suggestParentKey } from './parents';

const issue = (key: string, summary: string): JiraIssue => ({ key, id: key, summary, issueType: 'Story' });

const ranked = (summary: string, issues: JiraIssue[]) =>
  rankParentCandidates({ summary, issues }).map((candidate) => candidate.issue.key);

describe('rankParentCandidates', () => {
  it('puts the issue that shares the most wording first', () => {
    const issues = [
      issue('FIP-1', 'Checkout redesign'),
      issue('FIP-2', 'User management screen'),
      issue('FIP-3', 'Release tooling'),
    ];

    expect(ranked('User management screen', issues)[0]).toBe('FIP-2');
  });

  it('keeps the order it was given when nothing matches, which is recency', () => {
    const issues = [issue('FIP-1', 'Checkout redesign'), issue('FIP-2', 'Release tooling')];

    expect(ranked('User management', issues)).toEqual(['FIP-1', 'FIP-2']);
  });

  it('ignores words too short to mean anything', () => {
    const issues = [issue('FIP-1', 'On the go'), issue('FIP-2', 'Invite flow')];

    expect(ranked('Invite flow on the go', issues)[0]).toBe('FIP-2');
  });

  it('scores an issue with no wording in common at zero', () => {
    const [candidate] = rankParentCandidates({ summary: 'Invite flow', issues: [issue('FIP-1', 'Release tooling')] });

    expect(candidate?.score).toBe(0);
  });

  it('is not thrown off by a long summary on one side', () => {
    const short = rankParentCandidates({ summary: 'Invite flow', issues: [issue('FIP-1', 'Invite flow')] });
    const long = rankParentCandidates({
      summary: 'Invite flow',
      issues: [issue('FIP-1', 'Invite flow for every organisation member across the whole administration area')],
    });

    expect(short[0]?.score).toBe(1);
    expect(long[0]?.score).toBeGreaterThan(0);
    expect(long[0]?.score).toBeLessThan(1);
  });
});

describe('suggestParentKey', () => {
  const suggested = (summary: string, issues: JiraIssue[]) =>
    suggestParentKey(rankParentCandidates({ summary, issues }));

  it('fills in the parent that clearly matches the draft', () => {
    const issues = [issue('FIP-1', 'User management screen'), issue('FIP-2', 'Release tooling')];

    expect(suggested('User management screen', issues)).toBe('FIP-1');
  });

  it('suggests nothing when the best match shares too little wording', () => {
    expect(suggested('Invite flow', [issue('FIP-1', 'Release tooling')])).toBeUndefined();
  });

  it('suggests nothing when two issues match about equally well', () => {
    const issues = [issue('FIP-1', 'User management screen'), issue('FIP-2', 'User management screen')];

    expect(suggested('User management screen', issues)).toBeUndefined();
  });

  it('suggests nothing when there is nothing to suggest', () => {
    expect(suggestParentKey([])).toBeUndefined();
  });
});
