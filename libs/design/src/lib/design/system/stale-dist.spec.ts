import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildFailureLineOf,
  buildMissingDist,
  libBuildArgsOf,
  missingDistOf,
  rebuildStaleDist,
  staleDistWarningsOf,
} from './stale-dist';

vi.mock('child_process', async (importOriginal) => ({ ...(await importOriginal<object>()), spawnSync: vi.fn() }));

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

  it('builds in the Nx workspace that owns the build folder when the checkout links its libs and dist', () => {
    const errors = quiet();
    const workspace = realpathSync(checkout({ coreSource: 1_000, coreBuild: 2_000 }));
    const linked = mkdtempSync(join(tmpdir(), 'cli-design-stale-dist-linked-'));

    file(join(workspace, 'nx.json'), '{}', 1_000);

    for (const entry of ['libs', 'dist', 'nx.json']) symlinkSync(join(workspace, entry), join(linked, entry));

    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);

    expect(rebuildStaleDist({ target: linked, config })).toBe(true);
    expect(vi.mocked(spawnSync).mock.calls.map(([, , options]) => options?.cwd)).toEqual([workspace]);
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

describe('libBuildArgsOf', () => {
  const tail = ['--exclude-task-dependencies', '--skip-nx-cache'];

  it('rebuilds the lib with the targets its own build depends on, never its dependency libs', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'cli-design-lib-args-'));

    file(
      join(workspace, 'libs/components/project.json'),
      JSON.stringify({
        targets: {
          build: {
            dependsOn: ['^build', 'generate-version', { target: 'stage' }, { target: 'deps', dependencies: true }],
          },
        },
      }),
      1_000,
    );

    expect(libBuildArgsOf({ workspace, name: 'components' })).toEqual([
      ...['nx', 'run-many', '-t', 'generate-version', 'stage', 'build', '-p', 'components'],
      ...tail,
    ]);
  });

  it('takes the own targets from the executor default of nx.json when the project declares none', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'cli-design-lib-args-'));

    file(join(workspace, 'libs/types/project.json'), JSON.stringify({ targets: { build: { executor: 'tsc' } } }), 1);
    file(
      join(workspace, 'nx.json'),
      JSON.stringify({ targetDefaults: { tsc: { dependsOn: ['^build', 'prepare'] } } }),
      1_000,
    );

    expect(libBuildArgsOf({ workspace, name: 'types' })).toEqual([
      ...['nx', 'run-many', '-t', 'prepare', 'build', '-p', 'types'],
      ...tail,
    ]);
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

describe('buildMissingDist', () => {
  const linkedCheckout = () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-missing-workspace-')));
    const linked = mkdtempSync(join(tmpdir(), 'cli-design-missing-linked-'));

    file(join(workspace, 'nx.json'), '{}', 1_000);
    file(join(workspace, 'libs/core/src/index.ts'), 'export {};', 1_000);
    mkdirSync(join(workspace, 'dist/libs'), { recursive: true });

    for (const entry of ['nx.json', 'libs', 'dist']) symlinkSync(join(workspace, entry), join(linked, entry));

    return { workspace, linked };
  };

  it('builds a missing render module in the workspace its linked build folder belongs to', () => {
    const { workspace, linked } = linkedCheckout();
    const build = vi.fn(({ workspace: at }: { workspace: string; names: string[] }) => {
      file(join(at, 'dist/libs/core/package.json'), '{}', 2_000);

      return true;
    });

    expect(buildMissingDist({ target: linked, config, build })).toBe(true);
    expect(build).toHaveBeenCalledWith({ workspace, names: ['core'] });
    expect(missingDistOf({ target: linked, config })).toEqual([]);
  });

  it('answers false when the build leaves the folder missing', () => {
    expect(buildMissingDist({ target: linkedCheckout().linked, config, build: () => false })).toBe(false);
  });

  it('runs nx with the build dependencies of the missing libs', () => {
    const { linked } = linkedCheckout();

    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as never);
    buildMissingDist({ target: linked, config });

    expect(vi.mocked(spawnSync).mock.lastCall?.[1]).toEqual(['nx', 'run-many', '-t', 'build', '-p', 'core']);
  });

  it('builds nothing when no build folder is missing', () => {
    const build = vi.fn(() => true);

    expect(buildMissingDist({ target: checkout({ coreSource: 1_000, coreBuild: 2_000 }), config, build })).toBe(true);
    expect(build).not.toHaveBeenCalled();
  });
});
