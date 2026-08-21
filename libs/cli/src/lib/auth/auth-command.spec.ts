import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { authCommand } from './auth-command';
import { composerAuthPath } from './composer-auth';

const apisFile = (repoUrl: string, extra = '') => `module.exports = {
  hub: {
    composeDir: 'development',
    services: ['app'],
    execService: 'app',
    port: 8040,
    repoUrl: '${repoUrl}',
  },${extra}
};
`;

const SECOND_API = `
  other: {
    composeDir: 'development',
    services: ['app'],
    execService: 'app',
    port: 8000,
    repoUrl: 'ssh://git@b.example.com/group/other.git',
  },`;

const logs: string[] = [];
const errors: string[] = [];

vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));
vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));

afterEach(() => {
  logs.length = 0;
  errors.length = 0;
  vi.unstubAllGlobals();
});

/** A repo with one API checkout, whose composer.json names the private dependency the token is for. */
const makeRoot = (options: { apis?: string; composerRepoUrl?: string } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-auth-'));

  writeFileSync(join(root, 'package.json'), '{"name":"root"}', 'utf8');
  writeFileSync(
    join(root, 'ethlete.apis.js'),
    options.apis ?? apisFile('ssh://git@git.example.com:2224/group/hub-backend.git'),
    'utf8',
  );
  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });

  if (options.composerRepoUrl !== undefined) {
    writeFileSync(
      join(root, 'api/composer.json'),
      JSON.stringify({ repositories: [{ type: 'git', url: options.composerRepoUrl }] }),
      'utf8',
    );
  }

  return root;
};

const makeHome = () => mkdtempSync(join(tmpdir(), 'cli-auth-home-'));

/** Answers the token request and every refs request, so each case reads as a pair of statuses. */
const stubFetch = (token: { status: number; body?: unknown }, refs: { status: number }) => {
  const calls: string[] = [];

  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url);

    if (url.includes('personal_access_tokens/self')) {
      return Promise.resolve({
        status: token.status,
        ok: token.status >= 200 && token.status < 300,
        json: () => Promise.resolve(token.body ?? {}),
      });
    }

    return Promise.resolve({ status: refs.status, ok: refs.status < 400, body: undefined });
  });

  return calls;
};

const readTokens = (home: string) =>
  (JSON.parse(readFileSync(composerAuthPath(home), 'utf8')) as Record<string, unknown>)['gitlab-token'];

const VALID = { status: 200, body: { name: 'laptop', scopes: ['api'], expires_at: null } };
const PROJECT_TOKEN = { status: 403 };

describe('authCommand', () => {
  it('writes the token when the private dependency can be fetched', async () => {
    const root = makeRoot({ composerRepoUrl: 'https://git.example.com/vendor/bundle.git' });
    const home = makeHome();

    stubFetch(VALID, { status: 200 });

    expect(await authCommand({ argv: ['glpat-good'], root, home })).toBe(0);
    expect(readTokens(home)).toEqual({ 'git.example.com': 'glpat-good' });
    expect(logs.join('\n')).toContain('scopes: api');
    expect(logs.join('\n')).toContain('fetch     vendor/bundle can be fetched');
  });

  it('checks the repositories in composer.json, not the API repo itself', async () => {
    const root = makeRoot({ composerRepoUrl: 'https://git.example.com/vendor/bundle.git' });
    const calls = stubFetch(VALID, { status: 200 });

    await authCommand({ argv: ['glpat-good'], root, home: makeHome() });

    expect(calls[0]).toBe('https://git.example.com/api/v4/personal_access_tokens/self');
    expect(calls[1]).toBe('https://git.example.com/vendor/bundle.git/info/refs?service=git-upload-pack');
    expect(calls.join('\n')).not.toContain('hub-backend');
  });

  it('accepts a project token that keeps its own details private', async () => {
    const root = makeRoot({ composerRepoUrl: 'https://git.example.com/vendor/bundle.git' });
    const home = makeHome();

    stubFetch(PROJECT_TOKEN, { status: 200 });

    expect(await authCommand({ argv: ['glpat-project'], root, home })).toBe(0);
    expect(logs.join('\n')).toContain('accepted, and keeps its own details private');
    expect(readTokens(home)).toEqual({ 'git.example.com': 'glpat-project' });
  });

  it('writes nothing when the dependency cannot be fetched', async () => {
    const root = makeRoot({ composerRepoUrl: 'https://git.example.com/vendor/bundle.git' });
    const home = makeHome();

    stubFetch(PROJECT_TOKEN, { status: 403 });

    expect(await authCommand({ argv: ['glpat-weak'], root, home })).toBe(1);
    expect(existsSync(composerAuthPath(home))).toBe(false);
    expect(logs.join('\n')).toContain('403: this token cannot fetch it');
    expect(errors.join('\n')).toContain('Nothing was written.');
  });

  it('writes a token that cannot fetch when --force is given', async () => {
    const root = makeRoot({ composerRepoUrl: 'https://git.example.com/vendor/bundle.git' });
    const home = makeHome();

    stubFetch(PROJECT_TOKEN, { status: 403 });

    expect(await authCommand({ argv: ['glpat-weak', '--force'], root, home })).toBe(0);
    expect(existsSync(composerAuthPath(home))).toBe(true);
  });

  it('writes without a fetch check when no dependency sits on that host', async () => {
    const root = makeRoot();
    const home = makeHome();

    stubFetch(VALID, { status: 403 });

    expect(await authCommand({ argv: ['glpat-good'], root, home })).toBe(0);
    expect(logs.join('\n')).toContain('no private dependency on that host to try');
  });

  it('writes nothing when the token itself is rejected', async () => {
    const home = makeHome();

    stubFetch({ status: 401 }, { status: 401 });

    expect(await authCommand({ argv: ['glpat-revoked'], root: makeRoot(), home })).toBe(1);
    expect(existsSync(composerAuthPath(home))).toBe(false);
    expect(errors.join('\n')).toContain('expired or revoked');
  });

  it('still writes when the host cannot be reached', async () => {
    const home = makeHome();

    vi.stubGlobal('fetch', () => Promise.reject(new Error('getaddrinfo ENOTFOUND')));

    expect(await authCommand({ argv: ['glpat-offline'], root: makeRoot(), home })).toBe(0);
    expect(logs.join('\n')).toContain('not checked: getaddrinfo ENOTFOUND');
  });

  it('names the hosts when more than one is in use', async () => {
    stubFetch(VALID, { status: 200 });

    const root = makeRoot({ apis: apisFile('ssh://git@a.example.com/group/hub.git', SECOND_API) });

    expect(await authCommand({ argv: ['glpat-good'], root, home: makeHome(), invocation: 'yarn auth' })).toBe(1);
    expect(errors.join('\n')).toContain('yarn auth a.example.com <token>');
    expect(errors.join('\n')).toContain('yarn auth b.example.com <token>');
  });

  it('takes the host as an argument', async () => {
    const home = makeHome();
    const root = makeRoot({ apis: apisFile('ssh://git@a.example.com/group/hub.git', SECOND_API) });

    stubFetch(VALID, { status: 200 });

    expect(await authCommand({ argv: ['b.example.com', 'glpat-good'], root, home })).toBe(0);
    expect(readTokens(home)).toEqual({ 'b.example.com': 'glpat-good' });
  });

  it('prints the usage when no token is given', async () => {
    expect(await authCommand({ argv: [], root: makeRoot(), invocation: 'yarn auth' })).toBe(1);
    expect(errors[0]).toContain('Usage: yarn auth [host] <token>');
  });

  it('answers --help on stdout and succeeds', async () => {
    expect(await authCommand({ argv: ['--help'], root: makeRoot() })).toBe(0);
    expect(logs[0]).toContain('Usage: et auth [host] <token>');
  });
});
