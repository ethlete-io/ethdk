import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { buildFailureLineOf, missingDistOf, rebuildStaleDist, staleDistWarningsOf } from './stale-dist';

const file = (path: string, content: string, at: number) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  utimesSync(path, at, at);
};

const checkout = (options: { coreSource: number; coreBuild: number }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-stale-dist-'));

  file(join(target, 'libs/core/src/index.ts'), 'export {};', options.coreSource);
  file(join(target, 'libs/core/src/index.spec.ts'), 'export {};', 3_000);
  file(
    join(target, 'dist/libs/core/package.json'),
    JSON.stringify({ name: '@ethlete/core', dependencies: { '@ethlete/types': '*' } }),
    options.coreBuild,
  );
  file(join(target, 'libs/types/src/index.ts'), 'export {};', 3_000);
  file(join(target, 'dist/libs/types/package.json'), JSON.stringify({ name: '@ethlete/types' }), 1_000);

  return target;
};

const config = { render: { packages: { '@ethlete/*': 'dist/libs/*' }, modules: ['@ethlete/core'] } };

describe('staleDistWarningsOf', () => {
  it('names each used lib whose source changed after its build, with the rebuild command', () => {
    expect(staleDistWarningsOf({ target: checkout({ coreSource: 2_000, coreBuild: 1_000 }), config })).toEqual([
      'WARNING STALE BUILD @ethlete/core - libs/core/src changed after dist/libs/core was built; the drawings use the old build - run npx nx build core',
      'WARNING STALE BUILD @ethlete/types - libs/types/src changed after dist/libs/types was built; the drawings use the old build - run npx nx build types',
    ]);
  });

  it('ignores a spec changed after the build', () => {
    expect(staleDistWarningsOf({ target: checkout({ coreSource: 1_000, coreBuild: 2_000 }), config })).toEqual([
      'WARNING STALE BUILD @ethlete/types - libs/types/src changed after dist/libs/types was built; the drawings use the old build - run npx nx build types',
    ]);
  });

  it('stays quiet for packages loaded from node_modules', () => {
    const target = checkout({ coreSource: 2_000, coreBuild: 1_000 });

    file(join(target, 'node_modules/@ethlete/core/package.json'), '{}', 1_000);

    expect(
      staleDistWarningsOf({ target, config: { render: { packages: { '@ethlete/*': 'node_modules/@ethlete/*' } } } }),
    ).toEqual([]);
  });
});

describe('rebuildStaleDist', () => {
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

  it('rebuilds each stale lib, dependencies first, and lets the drawing run once they are fresh', () => {
    const errors = quiet();
    const target = checkout({ coreSource: 2_000, coreBuild: 1_000 });
    const build = vi.fn(({ dir }: { name: string; dir: string }) => {
      utimesSync(join(dir, 'package.json'), 5_000, 5_000);

      return true;
    });

    expect(rebuildStaleDist({ target, config, build })).toBe(true);
    expect(build.mock.calls.map(([call]) => call.name)).toEqual(['types', 'core']);
    errors.mockRestore();
  });

  it('refuses with the build command when a rebuild fails', () => {
    const errors = quiet();
    const target = checkout({ coreSource: 1_000, coreBuild: 2_000 });

    expect(rebuildStaleDist({ target, config, build: () => false })).toBe(false);
    expect(errors.mock.calls.flat().join('\n')).toContain(
      'REFUSED STALE BUILD @ethlete/types - the build failed; fix it and run NX_NO_CLOUD=true npx nx build types --skip-nx-cache',
    );
    errors.mockRestore();
  });

  it('refuses with the build command when a lib is still stale after its rebuild', () => {
    const errors = quiet();
    const target = checkout({ coreSource: 1_000, coreBuild: 2_000 });

    expect(rebuildStaleDist({ target, config, build: () => true })).toBe(false);
    expect(errors.mock.calls.flat().join('\n')).toContain('run NX_NO_CLOUD=true npx nx build types --skip-nx-cache');
    errors.mockRestore();
  });

  it('builds nothing when every build is fresh', () => {
    const target = checkout({ coreSource: 1_000, coreBuild: 2_000 });
    const build = vi.fn(() => true);

    utimesSync(join(target, 'dist/libs/types/package.json'), 4_000, 4_000);

    expect(rebuildStaleDist({ target, config, build })).toBe(true);
    expect(build).not.toHaveBeenCalled();
  });
});

describe('buildFailureLineOf', () => {
  it('keeps the last output lines of a failed build in one line without colour codes', () => {
    const output = [
      ...Array.from({ length: 20 }, (_, i) => `line ${i}`),
      '\u001b[31mError: ENOENT dist/libs/types\u001b[39m',
      '',
    ].join('\n');

    expect(buildFailureLineOf({ name: 'types', output, status: 1, signal: null })).toBe(
      `BUILD OUTPUT types (exit 1): ${[...Array.from({ length: 11 }, (_, i) => `line ${i + 9}`), 'Error: ENOENT dist/libs/types'].join(' / ')}`,
    );
  });

  it('names the signal and an empty output', () => {
    expect(buildFailureLineOf({ name: 'types', output: '', status: null, signal: 'SIGKILL' })).toBe(
      'BUILD OUTPUT types (exit SIGKILL): (none)',
    );
  });
});

describe('missingDistOf', () => {
  it('names a render module whose build folder does not exist, with the build command', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-missing-dist-'));

    file(join(target, 'libs/core/src/index.ts'), 'export {};', 1_000);

    expect(missingDistOf({ target, config })).toEqual([
      'dist/libs/core is missing - run NX_NO_CLOUD=true npx nx build core --skip-nx-cache',
    ]);
  });

  it('answers nothing when the build folder exists', () => {
    expect(missingDistOf({ target: checkout({ coreSource: 1_000, coreBuild: 2_000 }), config })).toEqual([]);
  });
});
