import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../correlate/project-link';
import { AttributionRule } from '../correlate/rules';
import { WorklogProposal } from '../model/proposal';
import { inferTicketProjectKey, projectKeyOf } from './project';

const REPO = '/home/you/dev/abc-frontend';

const rule = (options: { repoPath: string; issueKey: string }): AttributionRule => ({
  id: options.repoPath,
  repoPath: options.repoPath,
  target: { kind: 'issue', issueKey: options.issueKey },
  createdAt: new Date('2026-08-01T00:00:00Z'),
});

const proposal = (issueKey: string): WorklogProposal => ({
  id: issueKey,
  issueKey,
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T10:00:00Z'),
  durationMs: 3_600_000,
  observedMs: 3_600_000,
  description: '',
  confidence: 'certain',
  evidence: [],
  state: 'suggested',
});

const link = (options: { path: string; projectKey: string }): TimetrackProjectLink => ({
  id: options.path,
  path: options.path,
  target: { kind: 'project', projectKey: options.projectKey },
  createdAt: new Date('2026-08-01T00:00:00Z'),
});

const infer = (options: {
  rules?: AttributionRule[];
  proposals?: WorklogProposal[];
  projectKeys?: string[];
  repoPath?: string;
  links?: TimetrackProjectLink[];
}) =>
  inferTicketProjectKey({
    context: { repoPath: options.repoPath ?? REPO },
    rules: options.rules ?? [],
    proposals: options.proposals ?? [],
    projectKeys: options.projectKeys ?? [],
    links: options.links ?? [],
  });

describe('projectKeyOf', () => {
  it('reads the project out of an issue key', () => {
    expect(projectKeyOf('abc-2177')).toBe('ABC');
  });

  it('names nothing for something that is not a key', () => {
    expect(projectKeyOf('user-management')).toBeUndefined();
  });
});

describe('inferTicketProjectKey', () => {
  it('prefers a rule the user already wrote about this repository', () => {
    expect(
      infer({
        rules: [rule({ repoPath: REPO, issueKey: 'ABC-1' })],
        projectKeys: ['ABC'],
        proposals: [proposal('ABC-2')],
      }),
    ).toBe('ABC');
  });

  it('ignores a rule about another repository', () => {
    expect(infer({ rules: [rule({ repoPath: '/home/you/dev/other', issueKey: 'ABC-1' })] })).toBeUndefined();
  });

  it('takes the single project the user picked', () => {
    expect(infer({ projectKeys: ['abc'] })).toBe('ABC');
  });

  it("falls back to the day's own work when it all sits in one project", () => {
    expect(infer({ proposals: [proposal('ABC-1'), proposal('ABC-2')] })).toBe('ABC');
  });

  it('reads a link before every other rung, including a rule about the same repository', () => {
    expect(
      infer({
        links: [link({ path: REPO, projectKey: 'GHI' })],
        rules: [rule({ repoPath: REPO, issueKey: 'ABC-100' })],
        projectKeys: ['ABC'],
      }),
    ).toBe('GHI');
  });

  it('reads a link on the directory root the repository sits in', () => {
    expect(infer({ links: [link({ path: '/home/you/dev', projectKey: 'GHI' })] })).toBe('GHI');
  });

  it('names nothing rather than choosing between two projects', () => {
    expect(infer({ projectKeys: ['ABC', 'DEF'] })).toBeUndefined();
    expect(infer({ proposals: [proposal('ABC-1'), proposal('DEF-2')] })).toBeUndefined();
  });
});
