import { describe, expect, it } from 'vitest';
import { JiraMirrorIssue } from '../jira/mirror';
import { rankMirrorCandidates, rankingTokensOf, ticketRequestText } from './mirror-rank';

const issue = (key: string, summary: string, extra: Partial<JiraMirrorIssue> = {}): JiraMirrorIssue => ({
  key,
  id: key,
  summary,
  issueType: 'Story',
  done: false,
  updatedMs: 1000,
  ...extra,
});

const busy = Array.from({ length: 150 }, (_, index) =>
  issue(`FIFAGG-${20000 + index}`, `Other work ${index}`, { updatedMs: 5000 + index }),
);

const keysOf = (issues: readonly { key: string }[]) => issues.map((entry) => entry.key);

describe('rankMirrorCandidates', () => {
  it('finds an old issue whose words the work carries, where the newest-first list never reached it', () => {
    const ranked = rankMirrorCandidates({
      issues: [...busy, issue('FIFAGG-100', 'Reward pass claim flow', { updatedMs: 1 })],
      projectKey: 'FIFAGG',
      text: 'feature/reward-pass Claim the reward pass in the shop',
    });

    expect(ranked[0]?.key).toBe('FIFAGG-100');
    expect(ranked).toHaveLength(25);
  });

  it('weighs a word few issues carry above one many carry', () => {
    const ranked = rankMirrorCandidates({
      issues: [
        issue('ABC-1', 'Frontend login form'),
        issue('ABC-2', 'Frontend bracket layout'),
        issue('ABC-3', 'Frontend settings page'),
      ],
      projectKey: 'ABC',
      text: 'frontend bracket',
    });

    expect(ranked[0]?.key).toBe('ABC-2');
  });

  it('boosts and marks an open child of the checkout’s epics, and reads the parent summary', () => {
    const ranked = rankMirrorCandidates({
      issues: [
        issue('ABC-1', 'Claim flow'),
        issue('ABC-2', 'Layout', { parentKey: 'ABC-9', parentSummary: 'Rewards claim' }),
      ],
      projectKey: 'ABC',
      text: 'claim',
      epicKeys: ['abc-9'],
    });

    expect(ranked[0]).toEqual(expect.objectContaining({ key: 'ABC-2', inEpic: true }));
    expect(ranked[1]).not.toHaveProperty('inEpic');
    expect(ranked[0]).not.toHaveProperty('done');
  });

  it('puts an issue the work names by key first', () => {
    const ranked = rankMirrorCandidates({
      issues: [issue('ABC-1', 'Claim flow'), issue('ABC-2', 'Something else')],
      projectKey: 'ABC',
      text: 'feature/ABC-2-claim-flow',
    });

    expect(ranked[0]?.key).toBe('ABC-2');
  });

  it('offers the most recently updated where no word matches', () => {
    const ranked = rankMirrorCandidates({
      issues: [issue('ABC-1', 'One', { updatedMs: 1 }), issue('ABC-2', 'Two', { updatedMs: 3 })],
      projectKey: 'ABC',
      text: 'nothing alike',
    });

    expect(keysOf(ranked)).toEqual(['ABC-2', 'ABC-1']);
  });

  it('never offers a done issue, a sub-task or an issue of another project', () => {
    const ranked = rankMirrorCandidates({
      issues: [
        issue('ABC-1', 'Claim flow', { done: true }),
        issue('ABC-2', 'Claim flow', { isSubtask: true }),
        issue('XYZ-3', 'Claim flow'),
        issue('ABC-4', 'Claim flow'),
      ],
      projectKey: 'abc',
      text: 'claim flow',
    });

    expect(keysOf(ranked)).toEqual(['ABC-4']);
  });
});

describe('rankingTokensOf', () => {
  it('splits camel case and separators, drops short and stop words, and folds a plural', () => {
    expect(rankingTokensOf('feature/rewardPasses and the UI-shop')).toEqual(['reward', 'passe', 'shop']);
  });
});

describe('ticketRequestText', () => {
  it('reads branch, notes, stand-in and spec, never the offered issues', () => {
    const text = ticketRequestText({
      branch: 'feature/rewards',
      notes: ['Claim flow'],
      standIn: { name: 'Shop', description: 'Layout', days: 1 },
      spec: { title: 'Spec title', tags: ['bracket'] },
    });

    expect(text).toBe('feature/rewards Claim flow Shop Layout Spec title bracket');
  });
});
