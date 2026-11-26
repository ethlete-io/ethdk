import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { compareVersions, isSinceSatisfied, readInstalledVersion } from './installed-version';

describe('migrate-from-cdk -> installed-version', () => {
  describe('compareVersions', () => {
    it('compares release versions numerically', () => {
      expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('ranks a prerelease below its release', () => {
      expect(compareVersions('1.0.0-next.34', '1.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0-next.34')).toBe(1);
    });

    it('compares prerelease counters numerically, not as strings', () => {
      expect(compareVersions('1.0.0-next.9', '1.0.0-next.34')).toBe(-1);
      expect(compareVersions('1.0.0-next.34', '1.0.0-next.34')).toBe(0);
      expect(compareVersions('1.0.0-next.35', '1.0.0-next.34')).toBe(1);
      expect(compareVersions('1.0.0-beta.11', '1.0.0-next.1')).toBe(-1);
    });
  });

  describe('isSinceSatisfied', () => {
    it('treats an unknown installed version as satisfied', () => {
      expect(isSinceSatisfied(null, '1.0.0-next.34')).toBe(true);
    });

    it('gates an older prerelease', () => {
      expect(isSinceSatisfied('1.0.0-next.33', '1.0.0-next.34')).toBe(false);
      expect(isSinceSatisfied('1.0.0-next.34', '1.0.0-next.34')).toBe(true);
      expect(isSinceSatisfied('1.1.0', '1.0.0-next.34')).toBe(true);
    });
  });

  describe('readInstalledVersion', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('reads a version out of any dependency field, range prefixes included', () => {
      tree.write(
        'package.json',
        JSON.stringify({
          dependencies: { '@ethlete/components': '^1.0.0-next.34' },
          devDependencies: { '@ethlete/core': '~5.0.0' },
        }),
      );

      expect(readInstalledVersion(tree, '@ethlete/components')).toBe('1.0.0-next.34');
      expect(readInstalledVersion(tree, '@ethlete/core')).toBe('5.0.0');
    });

    it('returns null for a missing dependency or a range nothing can be compared against', () => {
      tree.write('package.json', JSON.stringify({ dependencies: { '@ethlete/components': 'workspace:*' } }));

      expect(readInstalledVersion(tree, '@ethlete/components')).toBeNull();
      expect(readInstalledVersion(tree, '@ethlete/query')).toBeNull();
    });
  });
});
