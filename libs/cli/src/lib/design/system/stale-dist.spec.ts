import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { staleDistWarningsOf } from './stale-dist';

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
