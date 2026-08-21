import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { composerAuthPath, gitlabTokenHosts, writeGitlabToken } from './composer-auth';

const makeHome = (authJson?: string) => {
  const home = mkdtempSync(join(tmpdir(), 'cli-composer-'));

  if (authJson !== undefined) writeFileSync(join(home, 'auth.json'), authJson, 'utf8');

  return home;
};

const readAuth = (home: string) => JSON.parse(readFileSync(composerAuthPath(home), 'utf8')) as Record<string, unknown>;

describe('writeGitlabToken', () => {
  it('creates auth.json when there is none', () => {
    const home = makeHome();
    const result = writeGitlabToken({ home, host: 'git.example.com', token: 'glpat-new' });

    expect(result).toMatchObject({ ok: true, replaced: false });
    expect(readAuth(home)['gitlab-token']).toEqual({ 'git.example.com': 'glpat-new' });
  });

  it('keeps every other credential in the file', () => {
    const home = makeHome(
      JSON.stringify({
        'http-basic': { 'repo.example.com': { username: 'u', password: 'p' } },
        'gitlab-token': { 'other.example.com': 'glpat-other' },
      }),
    );

    expect(writeGitlabToken({ home, host: 'git.example.com', token: 'glpat-new' }).ok).toBe(true);

    const auth = readAuth(home);

    expect(auth['http-basic']).toEqual({ 'repo.example.com': { username: 'u', password: 'p' } });
    expect(auth['gitlab-token']).toEqual({ 'other.example.com': 'glpat-other', 'git.example.com': 'glpat-new' });
  });

  it('reports that it replaced a token for the same host', () => {
    const home = makeHome(JSON.stringify({ 'gitlab-token': { 'git.example.com': 'glpat-old' } }));

    expect(writeGitlabToken({ home, host: 'git.example.com', token: 'glpat-new' })).toMatchObject({ replaced: true });
  });

  it('leaves a file it cannot parse alone', () => {
    const home = makeHome('{ not json');
    const result = writeGitlabToken({ home, host: 'git.example.com', token: 'glpat-new' });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ problem: expect.stringContaining('is not valid JSON') });
    expect(readFileSync(composerAuthPath(home), 'utf8')).toBe('{ not json');
  });

  it('leaves auth.json readable only by its owner', () => {
    const home = makeHome(JSON.stringify({ 'gitlab-token': {} }));

    chmodSync(composerAuthPath(home), 0o644);
    writeGitlabToken({ home, host: 'git.example.com', token: 'glpat-new' });

    expect(statSync(composerAuthPath(home)).mode & 0o777).toBe(0o600);
  });

  it('creates a composer home that does not exist yet', () => {
    const home = join(mkdtempSync(join(tmpdir(), 'cli-composer-')), 'nested');

    expect(writeGitlabToken({ home, host: 'git.example.com', token: 'glpat-new' }).ok).toBe(true);
    expect(readAuth(home)['gitlab-token']).toEqual({ 'git.example.com': 'glpat-new' });
  });
});

describe('gitlabTokenHosts', () => {
  it('lists the hosts a token is stored for', () => {
    const home = makeHome(JSON.stringify({ 'gitlab-token': { 'a.example.com': 'x', 'b.example.com': 'y' } }));

    expect(gitlabTokenHosts(home)).toEqual(['a.example.com', 'b.example.com']);
  });

  it('is empty when there is no file', () => {
    expect(gitlabTokenHosts(makeHome())).toEqual([]);
  });
});
