import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkoutApiBranch, currentBranch, hasUncommittedChanges, pullApiBranch } from './git';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });

const logs: string[] = [];
const errors: string[] = [];
const warnings: string[] = [];

vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));
vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => void warnings.push(String(message)));

afterEach(() => {
  logs.length = 0;
  errors.length = 0;
  warnings.length = 0;
});

/** A bare origin, a clone that pushes to it, and a second clone standing in for the API checkout. */
const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-git-'));
  const origin = join(root, 'origin.git');
  const upstream = join(root, 'upstream');
  const repoPath = join(root, 'checkout');

  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, upstream);
  git(upstream, 'config', 'user.email', 'test@test');
  git(upstream, 'config', 'user.name', 'test');
  writeFileSync(join(upstream, 'file.txt'), 'one\n', 'utf8');
  git(upstream, 'add', '-A');
  git(upstream, 'commit', '-qm', 'one');
  git(upstream, 'push', '-q', '-u', 'origin', 'main');
  git(root, 'clone', '-q', origin, repoPath);
  git(repoPath, 'config', 'user.email', 'test@test');
  git(repoPath, 'config', 'user.name', 'test');

  const advanceOrigin = (contents: string) => {
    writeFileSync(join(upstream, 'file.txt'), contents, 'utf8');
    git(upstream, 'commit', '-qam', 'next');
    git(upstream, 'push', '-q', 'origin', 'main');
  };

  return { repoPath, advanceOrigin, read: () => readFileSync(join(repoPath, 'file.txt'), 'utf8') };
};

describe('currentBranch', () => {
  it('reads the checked-out branch', () => {
    expect(currentBranch(makeFixture().repoPath)).toBe('main');
  });

  it('is undefined outside a git checkout', () => {
    expect(currentBranch(mkdtempSync(join(tmpdir(), 'cli-git-none-')))).toBeUndefined();
  });
});

describe('hasUncommittedChanges', () => {
  it('is false on a clean checkout', () => {
    expect(hasUncommittedChanges(makeFixture().repoPath)).toBe(false);
  });

  it('is true once a tracked file changes', () => {
    const { repoPath } = makeFixture();

    writeFileSync(join(repoPath, 'file.txt'), 'edited\n', 'utf8');

    expect(hasUncommittedChanges(repoPath)).toBe(true);
  });
});

describe('checkoutApiBranch', () => {
  it('does nothing when the branch is already checked out', () => {
    const { repoPath } = makeFixture();

    expect(checkoutApiBranch({ repoPath, branch: 'main' })).toBe(0);
    expect(logs).toEqual(['Already on main.']);
  });

  it('switches to another branch', () => {
    const { repoPath } = makeFixture();

    git(repoPath, 'branch', 'other');

    expect(checkoutApiBranch({ repoPath, branch: 'other' })).toBe(0);
    expect(currentBranch(repoPath)).toBe('other');
  });

  it('fails on a branch that does not exist', () => {
    expect(checkoutApiBranch({ repoPath: makeFixture().repoPath, branch: 'nope' })).not.toBe(0);
  });
});

describe('pullApiBranch', () => {
  it('fast-forwards a clean checkout', () => {
    const fixture = makeFixture();

    fixture.advanceOrigin('one\ntwo\n');

    expect(pullApiBranch({ repoPath: fixture.repoPath, force: false })).toBe(0);
    expect(fixture.read()).toBe('one\ntwo\n');
  });

  it('refuses to run on a dirty checkout', () => {
    const fixture = makeFixture();

    writeFileSync(join(fixture.repoPath, 'file.txt'), 'local\n', 'utf8');

    expect(pullApiBranch({ repoPath: fixture.repoPath, force: false })).toBe(1);
    expect(errors[0]).toContain('has uncommitted changes');
    expect(fixture.read()).toBe('local\n');
  });

  it('discards local changes when forced', () => {
    const fixture = makeFixture();

    fixture.advanceOrigin('one\ntwo\n');
    writeFileSync(join(fixture.repoPath, 'file.txt'), 'local\n', 'utf8');

    expect(pullApiBranch({ repoPath: fixture.repoPath, force: true })).toBe(0);
    expect(fixture.read()).toBe('one\ntwo\n');
  });

  it('leaves untracked files alone when forced, so vendor and .env survive', () => {
    const fixture = makeFixture();

    writeFileSync(join(fixture.repoPath, '.env'), 'SECRET=1\n', 'utf8');
    fixture.advanceOrigin('one\ntwo\n');

    expect(pullApiBranch({ repoPath: fixture.repoPath, force: true })).toBe(0);
    expect(readFileSync(join(fixture.repoPath, '.env'), 'utf8')).toBe('SECRET=1\n');
  });

  it('warns when the checked-out branch is not the configured one', () => {
    const fixture = makeFixture();

    git(fixture.repoPath, 'checkout', '-q', '-b', 'other');
    pullApiBranch({ repoPath: fixture.repoPath, expectedBranch: 'main', force: false });

    expect(warnings[0]).toContain('On other, but apiRepoBranches expects main');
  });

  it('fails outside a git checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-git-none-'));

    expect(pullApiBranch({ repoPath: root, force: false })).toBe(1);
    expect(errors[0]).toContain('is not a git checkout');
  });
});
