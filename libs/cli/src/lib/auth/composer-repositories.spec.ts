import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { composerGitRepositories } from './composer-repositories';

const makeRepo = (composerJson?: string) => {
  const repo = mkdtempSync(join(tmpdir(), 'cli-composer-repos-'));

  if (composerJson !== undefined) writeFileSync(join(repo, 'composer.json'), composerJson, 'utf8');

  return repo;
};

describe('composerGitRepositories', () => {
  it('reads the urls out of a list', () => {
    const repo = makeRepo(
      JSON.stringify({
        repositories: [
          { type: 'git', url: 'https://git.example.com/vendor/one.git' },
          { type: 'vcs', url: 'https://git.example.com/vendor/two.git' },
        ],
      }),
    );

    expect(composerGitRepositories(repo)).toEqual([
      'https://git.example.com/vendor/one.git',
      'https://git.example.com/vendor/two.git',
    ]);
  });

  it('reads the urls out of a name-keyed map', () => {
    const repo = makeRepo(
      JSON.stringify({ repositories: { one: { type: 'git', url: 'https://git.example.com/vendor/one.git' } } }),
    );

    expect(composerGitRepositories(repo)).toEqual(['https://git.example.com/vendor/one.git']);
  });

  it('leaves out an entry with no url, such as a disabled packagist', () => {
    const repo = makeRepo(JSON.stringify({ repositories: [{ packagist: false }] }));

    expect(composerGitRepositories(repo)).toEqual([]);
  });

  it('is empty when there is no composer.json, or it cannot be parsed', () => {
    expect(composerGitRepositories(makeRepo())).toEqual([]);
    expect(composerGitRepositories(makeRepo('{ not json'))).toEqual([]);
    expect(composerGitRepositories(makeRepo('{}'))).toEqual([]);
  });
});
