import { describe, expect, it } from 'vitest';
import { CommandResult, ReleaseIo, pathsChangedBetween, release, releaseFlags } from './release';
import { PackageManager } from './update/package-manager';

const yarn: PackageManager = { name: 'yarn', install: ['yarn', 'install'], run: ['yarn'] };
const npm: PackageManager = { name: 'npm', install: ['npm', 'install'], run: ['npx'] };

type Setup = {
  dirty?: boolean;
  answer?: string;
  fail?: Record<string, CommandResult>;
  args?: string[];
  manager?: PackageManager;
  hasChangesets?: boolean;
};

const runRelease = async (setup: Setup = {}) => {
  const calls: string[] = [];
  const errors: string[] = [];
  const logs: string[] = [];
  let snapshots = 0;

  const io: ReleaseIo = {
    run: (command) => {
      const line = command.join(' ');

      calls.push(line);

      const failure = setup.fail?.[line];

      if (failure) return failure;
      if (line === 'git status --porcelain') return { status: 0, output: setup.dirty ? ' M a.ts\n' : '' };
      if (line.endsWith('changeset --version')) return { status: 0, output: '2.29.0\n' };

      return { status: 0, output: '' };
    },
    snapshot: () => {
      snapshots += 1;

      return snapshots === 1
        ? new Map([['.changeset/x.md', 'x']])
        : new Map([
            ['.changeset/x.md', 'deleted'],
            ['package.json', 'p2'],
          ]);
    },
    ask: async () => setup.answer ?? '',
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  };

  const code = await release({
    args: setup.args ?? [],
    root: '/repo',
    invocation: 'yarn et release',
    manager: setup.manager ?? yarn,
    hasChangesets: setup.hasChangesets ?? true,
    io,
  });

  return { code, calls, errors: errors.join('\n'), logs: logs.join('\n') };
};

describe('releaseFlags', () => {
  it('reads each flag and its alias', () => {
    expect(releaseFlags(['--force', '-sp'])).toMatchObject({ shouldForce: true, skipPush: true, problems: [] });
    expect(releaseFlags(['-f', '--skip-push'])).toMatchObject({ shouldForce: true, skipPush: true, problems: [] });
  });

  it('reads the commit message in both forms', () => {
    expect(releaseFlags(['--message', 'chore(release): Release']).message).toBe('chore(release): Release');
    expect(releaseFlags(['--message=chore: x']).message).toBe('chore: x');
  });

  it('reports an unknown flag instead of reading a flag out of it', () => {
    expect(releaseFlags(['--no-fail-fast', '--spec']).problems).toEqual([
      'Unknown flag "--no-fail-fast".',
      'Unknown flag "--spec".',
    ]);
  });

  it('reports a --message without a value', () => {
    expect(releaseFlags(['--message']).problems).toEqual(['--message needs a value.']);
    expect(releaseFlags(['-m', '--force']).problems).toEqual(['-m needs a value.']);
  });
});

describe('release', () => {
  it('versions, stages the changed paths, commits, then tags and pushes', async () => {
    const { code, calls } = await runRelease();

    expect(code).toBe(0);
    expect(calls).toEqual([
      'git status --porcelain',
      'yarn changeset version',
      'git add -- .changeset/x.md package.json',
      'git commit -m Release versions',
      'yarn changeset --version',
      'yarn changeset tag',
      'git push --follow-tags',
    ]);
  });

  it('writes no tag when the commit fails', async () => {
    const { code, calls, errors } = await runRelease({
      fail: { 'git commit -m Release versions': { status: 1, output: '' } },
    });

    expect(code).toBe(1);
    expect(calls.some((call) => call.startsWith('yarn changeset tag'))).toBe(false);
    expect(calls).not.toContain('git push --follow-tags');
    expect(errors).toContain('no tag was written');
  });

  it('does not push when tagging the release commit fails', async () => {
    const { code, calls, errors } = await runRelease({
      fail: { 'yarn changeset tag': { status: 1, output: 'tag exists' } },
    });

    expect(code).toBe(1);
    expect(calls).toContain('git commit -m Release versions');
    expect(calls).not.toContain('git push --follow-tags');
    expect(errors).toContain('tagging it failed');
  });

  it('exits 1 when the push fails', async () => {
    const { code, errors } = await runRelease({ fail: { 'git push --follow-tags': { status: 1, output: '' } } });

    expect(code).toBe(1);
    expect(errors).toContain('`git push --follow-tags` failed');
  });

  it('commits with the message passed in', async () => {
    const { calls } = await runRelease({ args: ['--message', 'chore(release): Release versions'] });

    expect(calls).toContain('git commit -m chore(release): Release versions');
  });

  it('does not push with --skip-push', async () => {
    const { code, calls } = await runRelease({ args: ['--skip-push'] });

    expect(code).toBe(0);
    expect(calls).not.toContain('git push --follow-tags');
    expect(calls).toContain('yarn changeset tag');
  });

  it('runs changesets through the detected package manager', async () => {
    const { calls } = await runRelease({ manager: npm });

    expect(calls).toContain('npx changeset version');
    expect(calls).toContain('npx changeset tag');
  });

  it('aborts on a dirty tree unless forced', async () => {
    expect((await runRelease({ dirty: true })).calls).toEqual(['git status --porcelain']);
    expect((await runRelease({ dirty: true, args: ['--force'] })).code).toBe(0);
  });

  it('aborts when the answer is not empty', async () => {
    const { code, calls } = await runRelease({ answer: 'n' });

    expect(code).toBe(1);
    expect(calls).toEqual(['git status --porcelain']);
  });

  it('aborts without a commit when there are no changesets', async () => {
    const { code, calls, errors } = await runRelease({
      fail: { 'yarn changeset version': { status: 1, output: 'No unreleased changesets found' } },
    });

    expect(code).toBe(1);
    expect(errors).toContain('No unreleased changesets found');
    expect(calls.some((call) => call.startsWith('git commit'))).toBe(false);
  });

  it('prints the usage for --help and runs nothing', async () => {
    const { code, calls, logs } = await runRelease({ args: ['--help'] });

    expect(code).toBe(0);
    expect(calls).toEqual([]);
    expect(logs).toContain('Usage: yarn et release');
  });

  it('rejects an unknown flag before running anything', async () => {
    const { code, calls, errors } = await runRelease({ args: ['--dry-run'] });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(errors).toContain('Unknown flag "--dry-run".');
  });

  it('names the fix when @changesets/cli is not installed', async () => {
    const { code, calls, errors } = await runRelease({ hasChangesets: false });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(errors).toContain('yarn changeset init');
  });
});

describe('pathsChangedBetween', () => {
  it('returns only paths that the version step added, changed or removed', () => {
    const before = new Map([
      ['unrelated.ts', 'a'],
      ['package.json', 'p1'],
    ]);
    const after = new Map([
      ['unrelated.ts', 'a'],
      ['package.json', 'p2'],
      ['CHANGELOG.md', 'c'],
      ['.changeset/x.md', 'deleted'],
    ]);
    const beforeWithChangeset = new Map([...before, ['.changeset/x.md', 'x']]);

    expect(pathsChangedBetween(beforeWithChangeset, after).sort()).toEqual([
      '.changeset/x.md',
      'CHANGELOG.md',
      'package.json',
    ]);
  });

  it('returns nothing when the tree did not change', () => {
    const snapshot = new Map([['a.ts', '1']]);

    expect(pathsChangedBetween(snapshot, new Map(snapshot))).toEqual([]);
  });
});
