import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REGISTRY,
  fetchRegistryPackage,
  packageUrl,
  registryAuthorization,
  registryUrl,
  tagForInstalled,
} from './registry';

const makeRoot = (files: Record<string, string> = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-registry-'));

  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content, 'utf8');

  return root;
};

beforeEach(() => {
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'cli-registry-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const yarnDefault = { npm_config_registry: 'https://registry.yarnpkg.com' };

describe('registryUrl', () => {
  it('reads the registry of a project .npmrc over the one yarn 1 exports', () => {
    const root = makeRoot({ '.npmrc': 'registry=http://127.0.0.1:4873/\n' });

    expect(registryUrl({ root, manager: 'yarn', env: yarnDefault })).toBe('http://127.0.0.1:4873');
  });

  it('prefers a .yarnrc over an .npmrc for yarn 1', () => {
    const root = makeRoot({
      '.npmrc': 'registry=https://npmrc.example.com',
      '.yarnrc': '# yarn lockfile v1\nyarn-path ".yarn/releases/yarn.cjs"\nregistry "http://127.0.0.1:4873/"\n',
    });

    expect(registryUrl({ root, manager: 'yarn', env: yarnDefault })).toBe('http://127.0.0.1:4873');
  });

  it('reads a scoped registry from a .yarnrc', () => {
    const root = makeRoot({ '.yarnrc': '"@ethlete:registry" "https://scoped.example.com"\n' });

    expect(registryUrl({ root, manager: 'yarn', env: {} })).toBe('https://scoped.example.com');
  });

  it('reads npmRegistryServer and the @ethlete scope from a .yarnrc.yml', () => {
    const global = makeRoot({
      '.yarnrc.yml': 'nodeLinker: node-modules\nnpmRegistryServer: "https://berry.example.com"\n',
    });
    const scoped = makeRoot({
      '.npmrc': 'registry=https://ignored.example.com',
      '.yarnrc.yml':
        'npmRegistryServer: "https://berry.example.com"\nnpmScopes:\n  other:\n    npmRegistryServer: "https://other.example.com"\n  ethlete:\n    npmRegistryServer: "https://scoped.example.com"\n',
    });

    expect(registryUrl({ root: global, manager: 'yarn', env: {} })).toBe('https://berry.example.com');
    expect(registryUrl({ root: scoped, manager: 'yarn', env: {} })).toBe('https://scoped.example.com');
  });

  it('reads only the .npmrc for npm and pnpm', () => {
    const root = makeRoot({
      '.npmrc': '@ethlete:registry=https://scoped.example.com',
      '.yarnrc': 'registry "https://yarn.example.com"',
    });

    expect(registryUrl({ root, manager: 'pnpm', env: {} })).toBe('https://scoped.example.com');
  });

  it('falls back to the public registry', () => {
    expect(registryUrl({ root: makeRoot(), env: {} })).toBe(DEFAULT_REGISTRY);
  });

  it('follows the registry npm was configured with', () => {
    expect(registryUrl({ root: makeRoot(), env: { npm_config_registry: 'https://registry.example.com/' } })).toBe(
      'https://registry.example.com',
    );
  });

  it('prefers a registry set for the scope', () => {
    expect(
      registryUrl({
        root: makeRoot(),
        env: {
          'npm_config_@ethlete:registry': 'https://scoped.example.com',
          npm_config_registry: 'https://registry.example.com',
        },
      }),
    ).toBe('https://scoped.example.com');
  });
});

describe('registry auth', () => {
  it('reads the registry from the user .npmrc when the repo sets none', () => {
    const home = makeRoot({ '.npmrc': '@ethlete:registry=https://mirror.example.com/npm/\n' });

    expect(registryUrl({ root: makeRoot(), env: {}, home })).toBe('https://mirror.example.com/npm');
  });

  it('builds the header from the longest matching token entry, with the environment expanded', () => {
    const root = makeRoot({ '.npmrc': '//mirror.example.com/npm/:_authToken=${MIRROR_TOKEN}\n' });
    const home = makeRoot({
      '.npmrc': '//mirror.example.com/:_authToken=wide\n//other.example.com/:_authToken=other\n',
    });

    expect(
      registryAuthorization({
        registry: 'https://mirror.example.com/npm',
        root,
        home,
        env: { MIRROR_TOKEN: 'secret' },
      }),
    ).toBe('Bearer secret');
    expect(registryAuthorization({ registry: 'https://mirror.example.com', root, home, env: {} })).toBe('Bearer wide');
    expect(registryAuthorization({ registry: DEFAULT_REGISTRY, root, home, env: {} })).toBeUndefined();
  });

  it('sends the header with the lookup', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ 'dist-tags': {}, versions: {} })));

    vi.stubGlobal('fetch', fetch);

    await fetchRegistryPackage({ packageName: '@ethlete/core', registry: DEFAULT_REGISTRY, authorization: 'Bearer x' });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer x' }) }),
    );
  });
});

describe('packageUrl', () => {
  it('escapes the scope separator', () => {
    expect(packageUrl({ registry: DEFAULT_REGISTRY, packageName: '@ethlete/core' })).toBe(
      'https://registry.npmjs.org/@ethlete%2fcore',
    );
  });
});

describe('tagForInstalled', () => {
  it('stays on the tag the installed prerelease is on', () => {
    expect(tagForInstalled({ version: '5.0.0-next.46', distTags: { latest: '4.9.0', next: '5.0.0-next.55' } })).toBe(
      'next',
    );
  });

  it('follows the tag with the newest version of the same prerelease line', () => {
    expect(
      tagForInstalled({
        version: '0.1.0-next.15',
        distTags: { beta: '0.1.0-beta.9', latest: '0.1.0-next.18', next: '0.1.0-next.16' },
      }),
    ).toBe('latest');
    expect(
      tagForInstalled({ version: '1.0.0-next.60', distTags: { latest: '1.0.0-next.62', next: '1.0.0-next.64' } }),
    ).toBe('next');
  });

  it('follows latest for a release', () => {
    expect(tagForInstalled({ version: '4.8.0', distTags: { latest: '4.9.0', next: '5.0.0-next.55' } })).toBe('latest');
  });

  it('follows latest when the registry has no such tag', () => {
    expect(tagForInstalled({ version: '5.0.0-canary.1', distTags: { latest: '4.9.0' } })).toBe('latest');
  });

  it('follows latest when nothing is installed', () => {
    expect(tagForInstalled({ distTags: { latest: '4.9.0' } })).toBe('latest');
  });
});
