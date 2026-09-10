import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { Evidence } from '../model/evidence';
import { describeWork } from './describe';
import { WorkGroup } from './merge';

const AT = new Date('2026-08-11T08:00:00Z');
const FIP = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

const group = (options: { evidence?: Evidence[]; branch?: string; issueKey?: string }): WorkGroup => ({
  issueKey: options.issueKey,
  from: AT,
  to: new Date('2026-08-11T09:00:00Z'),
  observedMs: 60 * 60_000,
  confidence: 'certain',
  evidence: options.evidence ?? [],
  blocks: [{ from: AT, to: AT, context: { branch: options.branch }, evidence: options.evidence ?? [] }],
});

const commit = (subject: string, sha = 'abc1234'): Evidence => ({
  kind: 'commit',
  at: AT,
  detail: `${sha} ${subject}`,
  summary: subject,
});

describe('describeWork', () => {
  it('prefers commit subjects, which the user already wrote', () => {
    const text = describeWork({
      group: group({
        branch: 'feat/FIP-2177-user-management',
        evidence: [commit('feat(user): Add the invite form'), commit('fix(user): Trim the invite email', 'def5678')],
      }),
      config: FIP,
    });

    expect(text).toBe('feat(user): Add the invite form; fix(user): Trim the invite email');
  });

  it('counts the commits it does not quote', () => {
    const text = describeWork({
      group: group({
        evidence: [
          commit('one', 'a111111'),
          commit('two', 'b222222'),
          commit('three', 'c333333'),
          commit('four', 'd444444'),
          commit('five', 'e555555'),
        ],
      }),
      config: FIP,
    });

    expect(text).toBe('one; two; three (+2 more)');
  });

  it('does not repeat an identical subject committed twice', () => {
    const text = describeWork({
      group: group({ evidence: [commit('chore: Format', 'a111111'), commit('chore: Format', 'b222222')] }),
      config: FIP,
    });

    expect(text).toBe('chore: Format');
  });

  it('falls back to the agent session title when nothing was committed', () => {
    const text = describeWork({
      group: group({
        branch: 'feat/FIP-2177-user-management',
        evidence: [{ kind: 'agent-session', at: AT, detail: 'Wire the invite form', summary: 'Wire the invite form' }],
      }),
      config: FIP,
    });

    expect(text).toBe('Wire the invite form');
  });

  it('falls back to the branch subject, read as words', () => {
    const text = describeWork({ group: group({ branch: 'feat/FIP-2177-user-management' }), config: FIP });

    expect(text).toBe('user management');
  });

  it('uses the whole branch name when the grammar finds no subject', () => {
    const text = describeWork({ group: group({ branch: 'main' }), config: FIP });

    expect(text).toBe('main');
  });

  it('ignores an agent session that never had a title', () => {
    const text = describeWork({
      group: group({
        branch: 'feat/FIP-2177-user-management',
        evidence: [{ kind: 'agent-session', at: AT, detail: 'agent session 7f3 in /home/tom/dev/fut-frontend' }],
      }),
      config: FIP,
    });

    expect(text).toBe('user management');
  });

  it('names the issue when there is nothing else to say', () => {
    const text = describeWork({ group: group({ issueKey: 'FIP-2222' }), config: FIP });

    expect(text).toBe('work on FIP-2222');
  });

  it('says so when a group has neither an issue nor a description', () => {
    expect(describeWork({ group: group({}), config: FIP })).toBe('unattributed activity');
  });

  it('truncates a description that would not fit a worklog', () => {
    const text = describeWork({
      group: group({ evidence: [commit('a'.repeat(300))] }),
      config: FIP,
      options: { maxLength: 40 },
    });

    expect(text).toHaveLength(40);
    expect(text.endsWith('…')).toBe(true);
  });
});
