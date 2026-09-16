import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { ActivityBlock, streamKey } from '../model/block';
import { TimetrackProjectLink } from '../model/project-link';
import { WorklogProposal } from '../model/proposal';
import { EpicOptions, EpicSibling, branchSlugOf, epicQuestionOf, epicSiblingFor } from './epic-sibling';
import { WorkGroup } from './merge';

const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ABC'] });

const link = (path: string, projectKey?: string): TimetrackProjectLink => ({
  id: `link-${path}`,
  path,
  target: projectKey ? { kind: 'project', projectKey } : { kind: 'private' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const LINKS = [link('/dev/specs', 'ABC'), link('/dev/frontend', 'ABC')];

const SIBLING: EpicSibling = {
  repoPath: '/dev/specs',
  branch: 'spec/20260819_bracket-challenge',
  issueKey: 'ABC-12623',
  parentKey: 'ABC-12605',
  parentType: 'Epic',
  siblingKeys: ['ABC-12623', 'ABC-12624'],
  truncated: false,
};

const epics = (overrides: Partial<EpicOptions> = {}): EpicOptions => ({
  siblings: [SIBLING],
  claimed: ['ABC-12623'],
  ...overrides,
});

const CONTEXT = { repoPath: '/dev/frontend', branch: 'feature/20260819_bracket-challenge' };

const resolve = (options: { context?: typeof CONTEXT; epics?: EpicOptions; links?: TimetrackProjectLink[] } = {}) =>
  epicSiblingFor({
    context: options.context ?? CONTEXT,
    epics: options.epics ?? epics(),
    links: options.links ?? LINKS,
    config: CONFIG,
  });

describe('branchSlugOf', () => {
  it('reads the subject a conforming branch states', () => {
    expect(branchSlugOf({ branch: 'feature/20260819_bracket-challenge', config: CONFIG })).toBe(
      '20260819_bracket-challenge',
    );
  });

  it('falls back to the last segment where the type prefix is not one the grammar knows', () => {
    expect(branchSlugOf({ branch: 'spec/20260819_bracket-challenge', config: CONFIG })).toBe(
      '20260819_bracket-challenge',
    );
  });

  it('matches case-insensitively', () => {
    expect(branchSlugOf({ branch: 'spec/Bracket-Challenge', config: CONFIG })).toBe(
      branchSlugOf({ branch: 'feat/bracket-challenge', config: CONFIG }),
    );
  });

  it('names nothing for a protected branch', () => {
    expect(branchSlugOf({ branch: 'main', config: CONFIG })).toBeUndefined();
    expect(branchSlugOf({ branch: 'next', config: CONFIG })).toBeUndefined();
  });

  it('names nothing for a single-segment branch', () => {
    expect(branchSlugOf({ branch: 'master', config: CONFIG })).toBeUndefined();
    expect(branchSlugOf({ branch: 'wip', config: CONFIG })).toBeUndefined();
  });
});

describe('epicSiblingFor', () => {
  it('takes the one open child of the sibling parent nobody else books', () => {
    expect(resolve()).toMatchObject({ issueKey: 'ABC-12624', parentKey: 'ABC-12605', parentType: 'Epic' });
  });

  it('names the sibling checkout, the parent and its type in the evidence', () => {
    expect(resolve()?.detail).toBe(
      '`specs` books ABC-12623 on the same branch name; ABC-12624 is the only other open child of ABC-12605 (Epic)',
    );
  });

  it('answers nothing when two children are free', () => {
    expect(resolve({ epics: epics({ claimed: [] }) })).toBeUndefined();
  });

  it('answers nothing when every child is claimed', () => {
    expect(resolve({ epics: epics({ claimed: ['ABC-12623', 'ABC-12624'] }) })).toBeUndefined();
  });

  it('answers nothing when the cap cut the child list short', () => {
    expect(resolve({ epics: epics({ siblings: [{ ...SIBLING, truncated: true }] }) })).toBeUndefined();
  });

  it('answers nothing when two sibling checkouts point at different parents', () => {
    const other: EpicSibling = {
      ...SIBLING,
      repoPath: '/dev/docs',
      issueKey: 'ABC-14000',
      parentKey: 'ABC-13000',
      siblingKeys: ['ABC-14000', 'ABC-14001'],
    };

    const links = [...LINKS, link('/dev/docs', 'ABC')];

    expect(resolve({ epics: epics({ siblings: [SIBLING, other] }), links })).toBeUndefined();
  });

  it('answers nothing when the two checkouts file into different projects', () => {
    const links = [link('/dev/specs', 'ABC'), link('/dev/frontend', 'XYZ')];

    expect(resolve({ links })).toBeUndefined();
  });

  it('answers nothing when this checkout has no project link', () => {
    expect(resolve({ links: [link('/dev/specs', 'ABC')] })).toBeUndefined();
  });

  it('answers nothing for the checkout the sibling itself came from', () => {
    expect(resolve({ context: { repoPath: '/dev/specs', branch: 'spec/20260819_bracket-challenge' } })).toBeUndefined();
  });

  it('answers nothing when the slugs differ', () => {
    expect(resolve({ context: { ...CONTEXT, branch: 'feature/20260901_group-stage' } })).toBeUndefined();
  });

  it('answers nothing on a protected branch', () => {
    expect(resolve({ context: { ...CONTEXT, branch: 'main' } })).toBeUndefined();
  });
});

const block = (repoPath: string, branch: string): ActivityBlock => ({
  from: new Date('2026-08-12T09:00:00Z'),
  to: new Date('2026-08-12T10:00:00Z'),
  context: { repoPath, branch },
  evidence: [],
});

const group = (blocks: ActivityBlock[]): WorkGroup => ({
  from: blocks[0]?.from ?? new Date(0),
  to: blocks[blocks.length - 1]?.to ?? new Date(0),
  blocks,
  observedMs: 3_600_000,
  confidence: 'weak',
  evidence: [],
});

const proposal = (repoPath: string, issueKey: string) =>
  ({ id: `p-${issueKey}`, issueKey, laneKey: streamKey({ repoPath }) }) as WorklogProposal;

const rule = (repoPath: string, branch: string, issueKey: string): AttributionRule => ({
  id: `rule-${issueKey}`,
  repoPath,
  branch,
  target: { kind: 'issue', issueKey },
  author: 'user',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const FRONTEND_BLOCK = block('/dev/frontend', 'feature/20260819_bracket-challenge');
const SPECS_BLOCK = block('/dev/specs', 'spec/20260819_bracket-challenge');

const ask = (options: {
  blocks?: ActivityBlock[];
  unattributed?: WorkGroup[];
  proposals?: WorklogProposal[];
  rules?: AttributionRule[];
}) =>
  epicQuestionOf({
    blocks: options.blocks ?? [FRONTEND_BLOCK, SPECS_BLOCK],
    unattributed: options.unattributed ?? [group([FRONTEND_BLOCK])],
    proposals: options.proposals ?? [],
    rules: options.rules ?? [],
    config: CONFIG,
  });

describe('epicQuestionOf', () => {
  it('asks nothing when the day left no checkout unnamed', () => {
    expect(
      ask({ unattributed: [], rules: [rule('/dev/specs', SPECS_BLOCK.context.branch ?? '', 'ABC-12623')] }),
    ).toEqual({ candidates: [], claimed: [] });
  });

  it('asks nothing when no named checkout shares an unnamed slug', () => {
    const elsewhere = rule('/dev/other', 'feature/invoice-export', 'ABC-99');

    expect(ask({ rules: [elsewhere] }).candidates).toEqual([]);
  });

  it('takes the sibling a rule names, with the branch the rule was written for', () => {
    const question = ask({ rules: [rule('/dev/specs', 'spec/20260819_bracket-challenge', 'ABC-12623')] });

    expect(question.candidates).toEqual([
      { repoPath: '/dev/specs', branch: 'spec/20260819_bracket-challenge', issueKey: 'ABC-12623' },
    ]);
  });

  it("takes the sibling the day itself named, reading its branch back from the day's blocks", () => {
    const question = ask({ proposals: [proposal('/dev/specs', 'ABC-12623')] });

    expect(question.candidates).toEqual([
      { repoPath: '/dev/specs', branch: 'spec/20260819_bracket-challenge', issueKey: 'ABC-12623' },
    ]);
  });

  it('claims every key a row books and every key a rule names', () => {
    const question = ask({
      proposals: [proposal('/dev/specs', 'ABC-12623'), proposal('/dev/other', 'ABC-77')],
      rules: [rule('/dev/specs', 'spec/20260819_bracket-challenge', 'ABC-12623'), rule('/dev/third', 'next', 'ABC-88')],
    });

    expect([...question.claimed].sort()).toEqual(['ABC-12623', 'ABC-77', 'ABC-88']);
  });

  it('asks nothing for an unnamed checkout on a branch the slug rule refuses', () => {
    const protectedBlock = block('/dev/frontend', 'next');

    expect(ask({ blocks: [protectedBlock, SPECS_BLOCK], unattributed: [group([protectedBlock])] }).candidates).toEqual(
      [],
    );
  });
});
