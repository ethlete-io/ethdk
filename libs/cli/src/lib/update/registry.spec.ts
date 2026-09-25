import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY, packageUrl, registryUrl, tagForInstalled } from './registry';

const makeRoot = (files: Record<string, string> = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-registry-'));

  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content, 'utf8');

  return root;
};

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
