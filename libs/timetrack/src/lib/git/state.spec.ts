import { Observable, firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { readGitBranchState$ } from './state';

const ok = (stdout: string): ProcessResult => ({ code: 0, stdout, stderr: '' });
const failed: ProcessResult = { code: 128, stdout: '', stderr: 'not a git repository' };

const runnerOf = (byArgs: Record<string, ProcessResult>): { processes: TimetrackProcessRunner; seen: string[] } => {
  const seen: string[] = [];

  return {
    seen,
    processes: {
      run$: (spec: ProcessSpec): Observable<ProcessResult> => {
        const key = spec.args.join(' ');

        seen.push(key);

        return of(byArgs[key] ?? failed);
      },
    },
  };
};

const CLEAN = {
  'status --porcelain': ok(''),
  'for-each-ref --format=%(refname:short) refs/heads': ok('next\nfeat/user-management\n'),
  remote: ok('origin\n'),
  'for-each-ref --format=%(refname:strip=3) refs/remotes/origin': ok('HEAD\nnext\nfeat/user-management\n'),
  'remote get-url origin': ok('git@gitlab.test:braune-digital/fut-frontend.git\n'),
};

describe('readGitBranchState$', () => {
  it('reads a clean repository with a remote', async () => {
    const { processes } = runnerOf(CLEAN);

    await expect(firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }))).resolves.toEqual({
      dirty: false,
      localBranches: ['next', 'feat/user-management'],
      remote: {
        name: 'origin',
        url: 'git@gitlab.test:braune-digital/fut-frontend.git',
        branches: ['next', 'feat/user-management'],
      },
    });
  });

  it('reports a working tree with any change as dirty', async () => {
    const { processes } = runnerOf({ ...CLEAN, 'status --porcelain': ok(' M src/app.ts\n') });

    await expect(firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }))).resolves.toMatchObject({
      dirty: true,
    });
  });

  it('counts an untracked file as dirty', async () => {
    const { processes } = runnerOf({ ...CLEAN, 'status --porcelain': ok('?? notes.md\n') });

    await expect(firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }))).resolves.toMatchObject({
      dirty: true,
    });
  });

  it('omits the remote when the repository has none', async () => {
    const { processes } = runnerOf({ ...CLEAN, remote: ok('') });
    const state = await firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }));

    expect(state.remote).toBeUndefined();
    expect(state.localBranches).toEqual(['next', 'feat/user-management']);
  });

  it('prefers origin over another remote', async () => {
    const { processes, seen } = runnerOf({ ...CLEAN, remote: ok('fork\norigin\n') });

    await expect(firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }))).resolves.toMatchObject({
      remote: { name: 'origin' },
    });
    expect(seen).toContain('for-each-ref --format=%(refname:strip=3) refs/remotes/origin');
  });

  it('drops the remote HEAD, which is not a branch', async () => {
    const { processes } = runnerOf(CLEAN);
    const state = await firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }));

    expect(state.remote?.branches).not.toContain('HEAD');
  });

  it('reads a failed command as nothing found rather than throwing', async () => {
    const { processes } = runnerOf({});

    await expect(firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }))).resolves.toEqual({
      dirty: false,
      localBranches: [],
    });
  });

  it('runs every command in the repository it was given', async () => {
    const specs: ProcessSpec[] = [];
    const processes: TimetrackProcessRunner = {
      run$: (spec) => {
        specs.push(spec);

        return of(ok(''));
      },
    };

    await firstValueFrom(readGitBranchState$({ processes, repoPath: '/repo' }));

    expect(specs.every((spec) => spec.cwd === '/repo' && spec.command === 'git')).toBe(true);
  });
});
