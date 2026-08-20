import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gitUrlHost } from './auth-hint';
import { cloneApiRepo, isGitIgnored } from './clone';
import { runApiCommand } from './run';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });

const errors: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));

afterEach(() => {
  errors.length = 0;
});

const makeOrigin = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-clone-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');

  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'config', 'user.email', 'test@test');
  git(work, 'config', 'user.name', 'test');
  writeFileSync(join(work, 'file.txt'), 'one\n', 'utf8');
  git(work, 'add', '-A');
  git(work, 'commit', '-qm', 'one');
  git(work, 'push', '-q', '-u', 'origin', 'main');
  git(work, 'checkout', '-q', '-b', 'develop');
  writeFileSync(join(work, 'file.txt'), 'two\n', 'utf8');
  git(work, 'commit', '-qam', 'two');
  git(work, 'push', '-q', '-u', 'origin', 'develop');

  return { root, origin };
};

describe('cloneApiRepo', () => {
  it('clones into a directory that does not exist yet', () => {
    const { root, origin } = makeOrigin();
    const into = join(root, '.ethlete/fix');

    expect(cloneApiRepo({ repoUrl: origin, into })).toBe(0);
    expect(existsSync(join(into, 'file.txt'))).toBe(true);
  });

  it('checks out the branch it was given', () => {
    const { root, origin } = makeOrigin();
    const into = join(root, '.ethlete/fix');

    cloneApiRepo({ repoUrl: origin, into, branch: 'develop' });

    expect(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: into, encoding: 'utf8' }).trim()).toBe(
      'develop',
    );
  });

  it('refuses to clone over a directory that is already there', () => {
    const { root, origin } = makeOrigin();
    const into = join(root, '.ethlete/fix');

    mkdirSync(into, { recursive: true });

    expect(cloneApiRepo({ repoUrl: origin, into })).toBe(1);
    expect(errors[0]).toContain('already exists');
  });

  it('fails on a url that is not a repo', () => {
    const { root } = makeOrigin();

    expect(cloneApiRepo({ repoUrl: join(root, 'nope'), into: join(root, '.ethlete/fix') })).not.toBe(0);
  });
});

describe('isGitIgnored', () => {
  it('is true for a path the repo ignores', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-ignore-'));

    git(root, 'init', '-q');
    writeFileSync(join(root, '.gitignore'), '.ethlete\n', 'utf8');

    expect(isGitIgnored(root, join(root, '.ethlete/hub'))).toBe(true);
  });

  it('is false for a path the repo would track', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-ignore-'));

    git(root, 'init', '-q');
    writeFileSync(join(root, '.gitignore'), 'node_modules\n', 'utf8');

    expect(isGitIgnored(root, join(root, '.ethlete/hub'))).toBe(false);
  });
});

describe('gitUrlHost', () => {
  it('reads the host of an scp-style url', () => {
    expect(gitUrlHost('git@gitlab.example.com:group/repo.git')).toBe('gitlab.example.com');
  });

  it('reads the host of an https url', () => {
    expect(gitUrlHost('https://gitlab.example.com/group/repo.git')).toBe('gitlab.example.com');
  });

  it('reads the host of an ssh url', () => {
    expect(gitUrlHost('ssh://git@gitlab.example.com/group/repo.git')).toBe('gitlab.example.com');
  });

  it('is undefined for a local path', () => {
    expect(gitUrlHost('/tmp/origin.git')).toBeUndefined();
  });
});

describe('the clone command', () => {
  const apiFor = (repoUrl: string) => ({
    fix: { composeDir: 'development', services: ['app'], execService: 'app', port: 1, repoUrl },
  });

  it('is its own consent, so it clones without --clone', async () => {
    const { root, origin } = makeOrigin();
    const repo = join(root, 'repo');

    mkdirSync(repo, { recursive: true });

    expect(await runApiCommand({ apis: apiFor(origin), argv: ['clone', 'fix'], root: repo })).toBe(0);
    expect(existsSync(join(repo, '.ethlete/fix/file.txt'))).toBe(true);
  });

  it('says so when the checkout is already there', async () => {
    const { root, origin } = makeOrigin();
    const repo = join(root, 'repo');

    mkdirSync(repo, { recursive: true });
    await runApiCommand({ apis: apiFor(origin), argv: ['clone', 'fix'], root: repo });

    const logs: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

    expect(await runApiCommand({ apis: apiFor(origin), argv: ['clone', 'fix'], root: repo })).toBe(0);
    expect(logs.join('\n')).toContain('already has a checkout');

    log.mockRestore();
  });

  it('explains a failed clone as a possible auth problem', async () => {
    const { root } = makeOrigin();
    const repo = join(root, 'repo');

    mkdirSync(repo, { recursive: true });

    expect(await runApiCommand({ apis: apiFor(join(root, 'nope.git')), argv: ['clone', 'fix'], root: repo })).not.toBe(
      0,
    );
    expect(errors.join('\n')).toContain('permission to DOWNLOAD code');
  });
});
