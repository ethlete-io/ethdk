import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY, packageUrl, registryUrl, tagForInstalled } from './registry';

describe('registryUrl', () => {
  it('falls back to the public registry', () => {
    expect(registryUrl({})).toBe(DEFAULT_REGISTRY);
  });

  it('follows the registry npm was configured with', () => {
    expect(registryUrl({ npm_config_registry: 'https://registry.example.com/' })).toBe('https://registry.example.com');
  });

  it('prefers a registry set for the scope', () => {
    expect(
      registryUrl({
        'npm_config_@ethlete:registry': 'https://scoped.example.com',
        npm_config_registry: 'https://registry.example.com',
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
