import { describe, expect, it } from 'vitest';
import { E2E_ISSUE_BRANCH, E2E_KEYLESS_BRANCH, E2E_PARENT_BRANCH, createFakeWorld } from '../world';
import { runFakeGit } from './git';

const backendOf = (seed: Parameters<typeof createFakeWorld>[0] = {}) => createFakeWorld(seed).backend;

describe('runFakeGit', () => {
  it('reports a clean tree as an empty status', () => {
    expect(runFakeGit(backendOf(), { args: ['status', '--porcelain'] })).toBe('');
  });

  it('reports one modified file when the fixture is dirty, which every write flow must refuse on', () => {
    expect(runFakeGit(backendOf({ git: { clean: false } }), { args: ['status', '--porcelain'] })).toBe(
      ' M src/invite.ts\n',
    );
  });

  it('records a mutating command instead of running it', () => {
    const backend = backendOf();

    expect(runFakeGit(backend, { args: ['switch', '-c', E2E_ISSUE_BRANCH] })).toBe('');
    expect(runFakeGit(backend, { args: ['push', '-u', 'origin', E2E_ISSUE_BRANCH] })).toBe('');
    expect(backend.git.ran).toEqual([`switch -c ${E2E_ISSUE_BRANCH}`, `push -u origin ${E2E_ISSUE_BRANCH}`]);
  });

  it('records nothing for a command that only reads', () => {
    const backend = backendOf();

    runFakeGit(backend, { args: ['status', '--porcelain'] });
    runFakeGit(backend, { args: ['remote'] });

    expect(backend.git.ran).toEqual([]);
  });

  it('answers the reflog of the checkout the command ran in', () => {
    const backend = backendOf({ git: { reflog: { '/Users/e2e/dev/other': 'HEAD@{x}' } } });

    expect(runFakeGit(backend, { args: ['reflog', 'show', '-n500'], cwd: '/Users/e2e/dev/other' })).toBe('HEAD@{x}');
    expect(runFakeGit(backend, { args: ['reflog', 'show', '-n500'], cwd: '/Users/e2e/dev/elsewhere' })).toBe('');
  });

  it('lists the local branches', () => {
    const listed = runFakeGit(backendOf(), { args: ['for-each-ref', '--format=%(refname:short)', 'refs/heads'] });

    expect(listed).toBe(`next\n${E2E_KEYLESS_BRANCH}\n${E2E_ISSUE_BRANCH}\n${E2E_PARENT_BRANCH}\n`);
  });

  it('lists the remote branches under a leading HEAD, the way git spells them', () => {
    const listed = runFakeGit(backendOf(), {
      args: ['for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin'],
    });

    expect(listed).toBe(`HEAD\nnext\n${E2E_KEYLESS_BRANCH}\n${E2E_PARENT_BRANCH}\n`);
  });

  it('names one remote and its url', () => {
    expect(runFakeGit(backendOf(), { args: ['remote'] })).toBe('origin\n');
    expect(runFakeGit(backendOf(), { args: ['remote', 'get-url', 'origin'] })).toBe(
      'git@gitlab.example.com:braune-digital/fut-frontend.git\n',
    );
  });
});
