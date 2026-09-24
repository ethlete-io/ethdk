import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { linkedWorktreesOf, parseGitWorktrees } from '../git/worktree';
import { UnnamedContext } from '../model/attribution';
import { ActivityContext, contextKey } from '../model/block';
import { TimetrackProjectLink, matchProjectLink, withWorktreeLinks } from '../model/project-link';
import { autoStandIns } from './auto-stand-in';

const MAIN = '/home/tom/dev/fut-frontend';
const WORKTREE = '/home/tom/dev/fut-frontend-altcha';

const LIST = [
  `worktree ${MAIN}`,
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/fix/security-audit-general',
  '',
  `worktree ${WORKTREE}`,
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/feat/login-altcha',
  '',
].join('\n');

const LINK: TimetrackProjectLink = {
  id: 'link:fut-frontend',
  path: MAIN,
  target: { kind: 'project', projectKey: 'FUT' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const worktrees = linkedWorktreesOf(parseGitWorktrees(LIST));

const unnamed = (context: ActivityContext): UnnamedContext => ({
  id: contextKey(context),
  context,
  observedMs: 30 * 60_000,
  from: new Date('2026-09-23T15:25:00Z'),
  to: new Date('2026-09-23T15:55:00Z'),
  suggestion: { repoPath: context.repoPath, branch: context.branch },
});

const open = (links: readonly TimetrackProjectLink[]) =>
  autoStandIns({
    contexts: [unnamed({ repoPath: WORKTREE, branch: 'feat/login-altcha' })],
    unattributed: [],
    links,
    rules: [],
    config: resolveGitFlowConfig({ keyPrefixes: ['FUT'] }),
    repoRoots: [MAIN, WORKTREE],
    offeredCheckouts: [],
    standIns: [],
    refused: [],
    day: '2026-09-23',
    now: new Date('2026-09-23T17:00:00Z'),
  });

describe('a linked worktree', () => {
  it('is read out of git worktree list as belonging to its main checkout', () => {
    expect(worktrees).toEqual({ [WORKTREE]: MAIN });
  });

  it('files its work in the project of its main checkout', () => {
    const links = withWorktreeLinks({ links: [LINK], worktrees });

    expect(matchProjectLink({ context: { repoPath: WORKTREE }, links })?.target).toEqual(LINK.target);
    expect(matchProjectLink({ context: { repoPath: '/home/tom/dev/fut-frontend-old' }, links })).toBeUndefined();
  });

  it('opens a stand-in in that project for its own branch', () => {
    const [opened] = open(withWorktreeLinks({ links: [LINK], worktrees }));

    expect(opened?.standIn.projectKey).toBe('FUT');
    expect(opened?.rule).toMatchObject({ repoPath: WORKTREE, branch: 'feat/login-altcha' });
  });

  it('keeps a link the user put on the worktree itself', () => {
    const own: TimetrackProjectLink = { ...LINK, id: 'link:altcha', path: WORKTREE, target: { kind: 'private' } };
    const links = withWorktreeLinks({ links: [LINK, own], worktrees });

    expect(matchProjectLink({ context: { repoPath: WORKTREE }, links })).toBe(own);
  });
});
