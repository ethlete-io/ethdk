import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designCommitHunks, withPartHunks } from './commit-hunks';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const repo = (files: Record<string, unknown>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-commit-hunks-'));

  git(target, 'init', '-q');
  git(target, 'config', 'user.email', 'a@b.c');
  git(target, 'config', 'user.name', 'a');
  git(target, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(target, 'p'));

  for (const [name, value] of Object.entries(files))
    writeFileSync(join(target, name), `${JSON.stringify(value, null, 2)}\n`);

  git(target, 'add', '.');
  git(target, 'commit', '-qm', 'init');

  return target;
};

const write = (target: string, name: string, value: unknown) =>
  writeFileSync(join(target, name), `${JSON.stringify(value, null, 2)}\n`);

const run = (target: string, ...argv: string[]) => designCommitHunks({ target, argv, invocation: 'et design' });

describe('designCommitHunks', () => {
  afterEach(() => vi.restoreAllMocks());

  it('commits one part, keeps the foreign hunks uncommitted and the working file as it was', async () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1', 'components/y': '1' } });
    const edited = { 'components/x': '2', 'components/y': '9', 'components/z': '3' };

    write(target, 'p/merged.json', edited);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await run(target, 'p/merged.json', '--part', 'components/x', '--part', 'components/z')).toBe(0);
    expect(JSON.parse(git(target, 'show', 'HEAD:p/merged.json'))).toEqual({
      'components/x': '2',
      'components/y': '1',
      'components/z': '3',
    });
    expect(JSON.parse(readFileSync(join(target, 'p/merged.json'), 'utf8'))).toEqual(edited);
    expect(git(target, 'diff', '--', 'p/merged.json')).toContain('"components/y": "9"');
    expect(git(target, 'log', '-1', '--format=%s')).toBe(
      'chore(repo): Record components/x, components/z in merged.json',
    );
    expect(git(target, 'show', '--stat', '--format=', 'HEAD')).not.toContain('init');
  });

  it('commits the entries of a part from a list and leaves the entries of another part', async () => {
    const target = repo({ 'p/log.json': [{ part: 'components/x', n: 1 }] });
    const edited = [
      { part: 'components/x', n: 1 },
      { part: 'components/y', n: 2 },
      { part: 'components/x', n: 3 },
    ];

    write(target, 'p/log.json', edited);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await run(target, 'p/log.json', '--part', 'components/x', '--message', 'chore(repo): Accept x')).toBe(0);
    expect(JSON.parse(git(target, 'show', 'HEAD:p/log.json'))).toEqual([
      { part: 'components/x', n: 1 },
      { part: 'components/x', n: 3 },
    ]);
    expect(JSON.parse(readFileSync(join(target, 'p/log.json'), 'utf8'))).toEqual(edited);
    expect(git(target, 'log', '-1', '--format=%s')).toBe('chore(repo): Accept x');
  });

  it('restores the working file and reports when the commit is refused', async () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });

    write(target, 'p/merged.json', { 'components/x': '2', 'components/y': '2' });
    writeFileSync(join(target, '.git/hooks/commit-msg'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await run(target, 'p/merged.json', '--part', 'components/x')).toBe(1);
    expect(error.mock.calls.flat().join('\n')).toContain('p/merged.json was not committed');
    expect(JSON.parse(readFileSync(join(target, 'p/merged.json'), 'utf8'))).toEqual({
      'components/x': '2',
      'components/y': '2',
    });
  });

  it('says so when the part has nothing uncommitted, and refuses a call without a part', async () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await run(target, 'p/merged.json', '--part', 'components/x')).toBe(0);
    expect(log.mock.calls.flat().join('\n')).toContain('holds no uncommitted entry of components/x');
    expect(await run(target, 'p/merged.json')).toBe(2);
    expect(await run(target, 'p/merged.json', '--part', 'nope')).toBe(2);
    expect(await run(target, 'p/merged.json', '--part', 'components/x', '--bogus')).toBe(2);
  });
});

describe('designCommitHunks key order', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes the part-keyed file sorted like the CLI writer and reports an order-only rest', async () => {
    const target = repo({ 'p/ready.json': { 'components/b': '1', 'components/c': '1', 'components/a': '1' } });
    const edited = { 'components/b': '1', 'components/c': '1', 'components/a': '2' };
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    write(target, 'p/ready.json', edited);

    expect(await run(target, 'p/ready.json', '--part', 'components/a')).toBe(0);
    expect(git(target, 'show', 'HEAD:p/ready.json')).toBe(
      `${JSON.stringify({ 'components/a': '2', 'components/b': '1', 'components/c': '1' }, null, 2)}`,
    );
    expect(log.mock.calls.flat().join('\n')).toContain('(order only)');
    expect(JSON.parse(readFileSync(join(target, 'p/ready.json'), 'utf8'))).toEqual(edited);
  });

  it('does not commit a pure reorder and names it as order only', async () => {
    const target = repo({ 'p/ready.json': { 'components/b': '1', 'components/a': '1' } });
    const before = git(target, 'rev-parse', 'HEAD');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await run(target, 'p/ready.json', '--part', 'components/a')).toBe(0);
    expect(git(target, 'rev-parse', 'HEAD')).toBe(before);
    expect(log.mock.calls.flat().join('\n')).not.toContain('key order');

    write(target, 'p/ready.json', { 'components/a': '1', 'components/b': '1' });
    expect(await run(target, 'p/ready.json', '--part', 'components/a')).toBe(0);
    expect(git(target, 'rev-parse', 'HEAD')).toBe(before);
    expect(log.mock.calls.flat().join('\n')).toContain('key order only');
  });
});

describe('designCommitHunks with a locked index', () => {
  afterEach(() => vi.restoreAllMocks());

  it('waits for index.lock to go and then commits', async () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });
    const lock = join(target, '.git/index.lock');
    const started = Date.now();

    write(target, 'p/merged.json', { 'components/x': '2' });
    writeFileSync(lock, '');
    spawn('sh', ['-c', `sleep 0.5; rm -f '${lock}'`], { detached: true, stdio: 'ignore' }).unref();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await run(target, 'p/merged.json', '--part', 'components/x')).toBe(0);
    expect(JSON.parse(git(target, 'show', 'HEAD:p/merged.json'))).toEqual({ 'components/x': '2' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
  });

  it('waits through waitForLock of the checkout, not through git retries', async () => {
    const target = repo({ 'p/merged.json': { 'components/x': '1' } });
    const lock = join(realpathSync(target), '.git/index.lock');
    const reported: string[] = [];

    mkdirSync(join(target, 'tools/scripts'), { recursive: true });
    writeFileSync(
      join(target, 'tools/scripts/commit-wait.mjs'),
      `export const waitForLock = async (lock) => { globalThis.__waited = lock; };\n`,
    );
    write(target, 'p/merged.json', { 'components/x': '2' });
    vi.spyOn(console, 'log').mockImplementation((message: string) => void reported.push(message));

    expect(await run(target, 'p/merged.json', '--part', 'components/x')).toBe(0);
    expect((globalThis as { __waited?: string }).__waited).toBe(lock);
  });
});

const DESIGN_ROOT = resolve(__dirname, '../../../../../.ethlete/design');

const sharedJsonFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory())
      return ['sketches', 'comments', 'notes', 'node_modules'].includes(entry.name) ? [] : sharedJsonFiles(path);

    return entry.name.endsWith('.json') && entry.name !== 'tsconfig.json' ? [path] : [];
  });

const SPLIT = [
  'merged.json',
  'pictures.json',
  'ready.json',
  'implemented.json',
  'inventory.json',
  'implementation-baseline.json',
];
const REFUSED = [
  'config.json',
  'overrides.json',
  'sign-in.json',
  'add-a-film.json',
  'review-a-film.json',
  'rule-baseline.json',
];

describe('designCommitHunks over every shared file under .ethlete/design', () => {
  afterEach(() => vi.restoreAllMocks());

  const files = existsSync(DESIGN_ROOT) ? sharedJsonFiles(DESIGN_ROOT) : [];

  it('finds the shared files, and every kind is classified as split or refused', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(
      files.filter((file) => ![...SPLIT, ...REFUSED, 'capabilities.json'].includes(file.split('/').at(-1) ?? '')),
    ).toEqual([]);
  });

  for (const file of files) {
    const name = relative(DESIGN_ROOT, file);

    it(`${name} splits per entry or refuses with a message`, async () => {
      const real = JSON.parse(readFileSync(file, 'utf8')) as unknown;
      const base = file.split('/').at(-1) ?? '';
      const target = repo({ 'p/x.json': real });
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      if (REFUSED.includes(base)) {
        expect(await run(target, 'p/x.json', '--part', 'components/a')).toBe(1);
        expect(error.mock.calls.flat().join('\n')).toContain('is not split per part');

        return;
      }

      if (base === 'capabilities.json') {
        const list = (real as { capabilities: [{ id: string }, ...{ id: string }[]] }).capabilities;
        const changed = { capabilities: [{ ...list[0], label: 'changed' }, ...list.slice(1), { id: 'brand-new' }] };

        write(target, 'p/x.json', changed);
        expect(await run(target, 'p/x.json')).toBe(2);
        expect(await run(target, 'p/x.json', '--id', list[0].id)).toBe(0);
        expect(JSON.parse(git(target, 'show', 'HEAD:p/x.json'))).toEqual({
          capabilities: [{ ...list[0], label: 'changed' }, ...list.slice(1)],
        });
        expect(JSON.parse(readFileSync(join(target, 'p/x.json'), 'utf8'))).toEqual(changed);

        return;
      }

      if (Array.isArray(real)) {
        const part = (real[0] as { part: string }).part;
        const changed = [...real, { part, extra: true }, { part: 'components/other', extra: true }];

        write(target, 'p/x.json', changed);
        expect(await run(target, 'p/x.json', '--part', part)).toBe(0);
        expect(JSON.parse(git(target, 'show', 'HEAD:p/x.json'))).toEqual([...real, { part, extra: true }]);
        expect(JSON.parse(readFileSync(join(target, 'p/x.json'), 'utf8'))).toEqual(changed);

        return;
      }

      const [part, other = part] = Object.keys(real as object) as [string, ...string[]];
      const changed = { ...(real as object), [part]: 'changed', [other]: 'changed', 'components/zz-new': 1 };

      write(target, 'p/x.json', changed);
      expect(await run(target, 'p/x.json', '--part', part, '--part', 'components/zz-new')).toBe(0);
      expect(JSON.parse(git(target, 'show', 'HEAD:p/x.json'))).toEqual({
        ...(real as object),
        [part]: 'changed',
        'components/zz-new': 1,
      });
      const keys = Object.keys(JSON.parse(git(target, 'show', 'HEAD:p/x.json')) as object);

      expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
      expect(JSON.parse(readFileSync(join(target, 'p/x.json'), 'utf8'))).toEqual(changed);
    });
  }
});

describe('withPartHunks', () => {
  it('drops the key of a part removed from the working tree and refuses another shape', () => {
    expect(
      withPartHunks({
        head: { 'components/x': '1', 'components/y': '1' },
        work: { 'components/y': '1' },
        parts: ['components/x'],
      }),
    ).toEqual({
      'components/y': '1',
    });
    expect(withPartHunks({ head: 'a', work: 'b', parts: ['components/x'] })).toEqual(
      expect.stringContaining('neither'),
    );
  });
});
