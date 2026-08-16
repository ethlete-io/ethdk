import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../correlate/project-link';
import { AttributionRule } from '../correlate/rules';
import { WorklogProposal } from '../model/proposal';
import { inferTicketProjectKey, projectKeyOf } from './project';

const REPO = '/Users/tom/dev/ea-frontend';

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
  prefixes?: string[];
  repoPath?: string;
  links?: TimetrackProjectLink[];
}) =>
  inferTicketProjectKey({
    context: { repoPath: options.repoPath ?? REPO },
    rules: options.rules ?? [],
    proposals: options.proposals ?? [],
    prefixes: options.prefixes ?? [],
    links: options.links ?? [],
  });

describe('projectKeyOf', () => {
  it('reads the project out of an issue key', () => {
    expect(projectKeyOf('fip-2177')).toBe('FIP');
  });

  it('names nothing for something that is not a key', () => {
    expect(projectKeyOf('user-management')).toBeUndefined();
  });
});

describe('inferTicketProjectKey', () => {
  it('prefers a rule the user already wrote about this repository', () => {
    expect(
      infer({
        rules: [rule({ repoPath: REPO, issueKey: 'FIP-1' })],
        prefixes: ['ABC'],
        proposals: [proposal('ABC-2')],
      }),
    ).toBe('FIP');
  });

  it('ignores a rule about another repository', () => {
    expect(infer({ rules: [rule({ repoPath: '/Users/tom/dev/other', issueKey: 'FIP-1' })] })).toBeUndefined();
  });

  it('takes the single project this machine is configured for', () => {
    expect(infer({ prefixes: ['fip'] })).toBe('FIP');
  });

  it("falls back to the day's own work when it all sits in one project", () => {
    expect(infer({ proposals: [proposal('FIP-1'), proposal('FIP-2')] })).toBe('FIP');
  });

  it('reads a link before every other rung, including a rule about the same repository', () => {
    expect(
      infer({
        links: [link({ path: REPO, projectKey: 'ETH' })],
        rules: [rule({ repoPath: REPO, issueKey: 'FIP-100' })],
        prefixes: ['FIP'],
      }),
    ).toBe('ETH');
  });

  it('reads a link on the directory root the repository sits in', () => {
    expect(infer({ links: [link({ path: '/Users/tom/dev', projectKey: 'ETH' })] })).toBe('ETH');
  });

  it('names nothing rather than choosing between two projects', () => {
    expect(infer({ prefixes: ['FIP', 'ABC'] })).toBeUndefined();
    expect(infer({ proposals: [proposal('FIP-1'), proposal('ABC-2')] })).toBeUndefined();
  });
});
