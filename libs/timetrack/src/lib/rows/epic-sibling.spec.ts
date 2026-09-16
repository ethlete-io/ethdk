import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { TimetrackProjectLink } from '../model/project-link';
import { EpicOptions, EpicSibling, branchSlugOf, epicSiblingFor } from './epic-sibling';

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
