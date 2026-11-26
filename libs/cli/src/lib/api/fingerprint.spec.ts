import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { NO_GIT, cliMajorVersion, fingerprintApi } from './fingerprint';

const write = (path: string, contents: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
};

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-fp-root-'));
  const repoPath = mkdtempSync(join(tmpdir(), 'cli-api-fp-repo-'));

  write(join(root, 'ethlete.apis.js'), 'module.exports = {};');
  write(join(root, '.ethlete/seeds/hub/seeds.json'), '{}');
  write(join(repoPath, 'db/migrations/001.sql'), 'create table a;');

  const fingerprint = (overrides: Partial<Parameters<typeof fingerprintApi>[0]> = {}) =>
    fingerprintApi({
      root,
      name: 'hub',
      repoPath,
      migrationsDir: 'db/migrations',
      seeds: ['users'],
      cliMajor: '3',
      head: () => 'abc',
      ...overrides,
    });

  return { root, repoPath, fingerprint };
};

describe('fingerprintApi', () => {
  it('is 12 hex characters and stable', () => {
    const { fingerprint } = setup();

    expect(fingerprint()).toMatch(/^[0-9a-f]{12}$/);
    expect(fingerprint()).toBe(fingerprint());
  });

  it('changes with each input', () => {
    const { root, repoPath, fingerprint } = setup();
    const base = fingerprint();
    const seen = new Set([base]);
    const change = (value: string) => {
      expect(value).not.toBe(base);
      seen.add(value);
    };

    change(fingerprint({ head: () => 'def' }));
    change(fingerprint({ seeds: ['users', 'teams'] }));
    change(fingerprint({ cliMajor: '4' }));
    change(fingerprint({ migrationsDir: undefined }));
    write(join(root, '.ethlete/seeds/hub/extra.sh'), 'x');
    change(fingerprint());
    write(join(root, 'ethlete.apis.js'), 'module.exports = { a: 1 };');
    change(fingerprint());
    write(join(repoPath, 'db/migrations/002.sql'), 'create table b;');
    change(fingerprint());
    expect(seen.size).toBe(8);
  });

  it('changes when a migration is edited or renamed', () => {
    const { repoPath, fingerprint } = setup();
    const base = fingerprint();

    write(join(repoPath, 'db/migrations/001.sql'), 'create table b;');

    const edited = fingerprint();

    expect(edited).not.toBe(base);

    write(join(repoPath, 'db/migrations/001.sql'), 'create table a;');
    write(join(repoPath, 'db/migrations/002.sql'), 'x');

    expect(fingerprint()).not.toBe(base);
  });

  it('uses no-git when the checkout is not a git repo, without failing', () => {
    const { repoPath, fingerprint } = setup();

    expect(fingerprint({ repoPath, head: () => undefined })).toBe(fingerprint({ head: () => undefined }));
    expect(fingerprint({ head: () => undefined })).not.toBe(fingerprint());
    expect(NO_GIT).toBe('no-git');
  });

  it('works on a checkout that is not a git repo with the real git lookup', () => {
    const { root, repoPath } = setup();

    expect(() => fingerprintApi({ root, name: 'hub', repoPath, seeds: [] })).not.toThrow();
  });
});

describe('cliMajorVersion', () => {
  it('reads the major from the package.json of the cli', () => {
    expect(cliMajorVersion()).toMatch(/^\d+$/);
  });
});
