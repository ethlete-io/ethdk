import { describe, expect, it } from 'vitest';
import { Migration, PackageMigrations } from './migration-manifest';
import { DeclaredPackage, DeclaredSite } from './packages';
import {
  availableMigrations,
  availableMigrationsLine,
  chooseTarget,
  isDowngrade,
  newerMajorLine,
  newerMajorOnTag,
  orderAvailableMigrations,
  orderMigrations,
  pendingMigrations,
  PendingMigration,
} from './plan';
import { RegistryPackage } from './registry';

const site = (overrides: Partial<DeclaredSite> = {}): DeclaredSite => ({
  manifestPath: 'package.json',
  field: 'dependencies',
  range: '^5.0.0-next.40',
  declaredVersion: '5.0.0-next.40',
  ...overrides,
});

const declared = (overrides: Partial<DeclaredPackage> = {}): DeclaredPackage => ({
  name: '@ethlete/core',
  sites: [site()],
  installedVersion: '5.0.0-next.40',
  ...overrides,
});

const registry = (overrides: Partial<RegistryPackage> = {}): RegistryPackage => ({
  distTags: { latest: '4.9.0', next: '5.0.0-next.55' },
  versions: ['4.9.0', '5.0.0-next.40', '5.0.0-next.55'],
  ...overrides,
});

const migration = (overrides: Partial<Migration> = {}): Migration => ({
  name: 'a-change',
  version: '5.0.0-next.46',
  kind: 'auto',
  level: 'required',
  description: 'Rewrite something',
  generator: '@ethlete/core:migrate-a-change',
  ...overrides,
});

describe('chooseTarget', () => {
  it('follows the tag the installed prerelease is on', () => {
    const choice = chooseTarget({ declared: declared(), registry: registry() });

    expect(choice).toEqual({
      update: {
        name: '@ethlete/core',
        from: '5.0.0-next.40',
        to: '5.0.0-next.55',
        tag: 'next',
        writes: [
          {
            name: '@ethlete/core',
            manifestPath: 'package.json',
            field: 'dependencies',
            range: '^5.0.0-next.55',
          },
        ],
        unwritable: [],
      },
    });
  });

  it('follows latest for an installed release', () => {
    const choice = chooseTarget({
      declared: declared({ sites: [site({ range: '^4.8.0', declaredVersion: '4.8.0' })], installedVersion: '4.8.0' }),
      registry: registry(),
    });

    expect(choice).toMatchObject({ update: { to: '4.9.0', tag: 'latest' } });
  });

  it('follows a tag the caller names', () => {
    expect(chooseTarget({ declared: declared(), registry: registry(), request: { tag: 'latest' } })).toMatchObject({
      update: { to: '4.9.0', tag: 'latest' },
    });
  });

  it('takes a version the caller names, with no tag', () => {
    expect(
      chooseTarget({ declared: declared(), registry: registry(), request: { version: '5.0.0-next.55' } }),
    ).toMatchObject({ update: { to: '5.0.0-next.55', tag: undefined } });
  });

  it('reports a version the registry does not have', () => {
    expect(chooseTarget({ declared: declared(), registry: registry(), request: { version: '9.9.9' } })).toEqual({
      problem: '@ethlete/core@9.9.9 is not on the registry.',
    });
  });

  it('reports a target that is not a version', () => {
    expect(chooseTarget({ declared: declared(), registry: registry(), request: { version: 'next' } })).toEqual({
      problem: '"next" is not a version.',
    });
  });

  it('reports a tag the registry does not have', () => {
    expect(chooseTarget({ declared: declared(), registry: registry(), request: { tag: 'canary' } })).toEqual({
      problem: '@ethlete/core has no "canary" version on the registry.',
    });
  });

  it('says nothing to do when the installed version is the target', () => {
    expect(
      chooseTarget({
        declared: declared({ installedVersion: '5.0.0-next.55' }),
        registry: registry(),
      }),
    ).toEqual({ upToDate: true });
  });

  it('writes no range for a range no single version fits into', () => {
    const choice = chooseTarget({
      declared: declared({ sites: [site({ range: '>=5 <6', declaredVersion: undefined })] }),
      registry: registry(),
    });

    expect(choice).toMatchObject({ update: { writes: [], unwritable: [{ range: '>=5 <6' }] } });
  });

  it('rewrites the range in every manifest that declares the package', () => {
    const choice = chooseTarget({
      declared: declared({
        sites: [
          site(),
          site({ manifestPath: 'libs/domain/auth/package.json', field: 'peerDependencies', range: '5.0.0-next.40' }),
        ],
      }),
      registry: registry(),
    });

    expect(choice).toMatchObject({
      update: {
        writes: [
          { manifestPath: 'package.json', field: 'dependencies', range: '^5.0.0-next.55' },
          { manifestPath: 'libs/domain/auth/package.json', field: 'peerDependencies', range: '5.0.0-next.55' },
        ],
      },
    });
  });

  it('refuses a dist tag that points at an older version than the installed one', () => {
    expect(
      chooseTarget({
        declared: declared({ installedVersion: '5.0.0-next.60' }),
        registry: registry(),
      }),
    ).toEqual({
      problem:
        '@ethlete/core: the "next" tag points at 5.0.0-next.55, which is older than the 5.0.0-next.60 this repo is on. ' +
        'The tag is stale. Pass `--to 5.0.0-next.55` to move back on purpose.',
    });
  });

  it('takes a downgrade the caller names with a version', () => {
    expect(
      chooseTarget({
        declared: declared({ installedVersion: '5.0.0-next.60' }),
        registry: registry(),
        request: { version: '5.0.0-next.40' },
      }),
    ).toMatchObject({ update: { to: '5.0.0-next.40' } });
  });

  it('falls back to the declared version when nothing is installed', () => {
    expect(chooseTarget({ declared: declared({ installedVersion: undefined }), registry: registry() })).toMatchObject({
      update: { from: undefined, tag: 'next' },
    });
  });

  it('falls back to the newest declared version, not the one a lagging manifest holds', () => {
    const choice = chooseTarget({
      declared: declared({
        installedVersion: undefined,
        sites: [
          site({ range: '^5.0.0-next.60', declaredVersion: '5.0.0-next.60' }),
          site({ manifestPath: 'libs/a/package.json', range: '5.0.0-next.10', declaredVersion: '5.0.0-next.10' }),
        ],
      }),
      registry: registry(),
    });

    expect(choice).toMatchObject({ problem: expect.stringContaining('older than the 5.0.0-next.60 this repo is on') });
  });
});

describe('isDowngrade', () => {
  it('is true when the target is older than the installed version', () => {
    expect(isDowngrade({ name: '@ethlete/core', from: '5.0.0', to: '4.9.0', writes: [], unwritable: [] })).toBe(true);
  });

  it('is false without an installed version', () => {
    expect(isDowngrade({ name: '@ethlete/core', to: '4.9.0', writes: [], unwritable: [] })).toBe(false);
  });
});

describe('pendingMigrations', () => {
  const packageMigrations: PackageMigrations = {
    packageName: '@ethlete/core',
    manifestPath: '/node_modules/@ethlete/core/migrations.json',
    problems: [],
    migrations: [
      migration({ name: 'older', version: '5.0.0-next.30' }),
      migration({ name: 'inside', version: '5.0.0-next.46' }),
      migration({ name: 'target', version: '5.0.0-next.55' }),
      migration({ name: 'later', version: '5.0.0-next.60' }),
    ],
  };

  it('takes the migrations the update crosses, including the target', () => {
    const pending = pendingMigrations({ packageMigrations, from: '5.0.0-next.40', to: '5.0.0-next.55' });

    expect(pending.map((entry) => entry.migration.name)).toEqual(['inside', 'target']);
  });

  it('carries the manifest path, so the instructions can be found', () => {
    const [first] = pendingMigrations({ packageMigrations, from: '5.0.0-next.40', to: '5.0.0-next.55' });

    expect(first?.manifestPath).toBe('/node_modules/@ethlete/core/migrations.json');
  });

  it('takes none when the versions match', () => {
    expect(pendingMigrations({ packageMigrations, from: '5.0.0-next.55', to: '5.0.0-next.55' })).toEqual([]);
  });
});

describe('migration levels', () => {
  const packageMigrations: PackageMigrations = {
    packageName: '@ethlete/core',
    problems: [],
    migrations: [
      migration({ name: 'must', version: '5.0.0-next.46', level: 'required' }),
      migration({ name: 'should', version: '5.0.0-next.46', level: 'recommended' }),
      migration({ name: 'could', version: '5.0.0-next.50', level: 'optional' }),
      migration({ name: 'older', version: '5.0.0-next.30', level: 'optional' }),
    ],
  };
  const range = { packageMigrations, from: '5.0.0-next.40', to: '5.0.0-next.55' };

  it('runs only the required migrations', () => {
    expect(pendingMigrations(range).map((entry) => entry.migration.name)).toEqual(['must']);
  });

  const reached = { packageMigrations, installed: '5.0.0-next.50', record: {} };
  const names = (entries: readonly PendingMigration[]) => entries.map((entry) => entry.migration.name);

  it('makes the others available once the installed version reaches them', () => {
    expect(names(availableMigrations(reached))).toEqual(['should', 'could', 'older']);
  });

  it('keeps a migration the installed version has not reached out', () => {
    expect(names(availableMigrations({ ...reached, installed: '5.0.0-next.49' }))).toEqual(['should', 'older']);
  });

  it('drops a migration the record holds a run of', () => {
    const record = { '@ethlete/core:older': { version: '5.0.0-next.31', ranAt: '2026-09-01T00:00:00.000Z' } };

    expect(names(availableMigrations({ ...reached, record }))).toEqual(['should', 'could']);
  });

  it('orders recommended before optional', () => {
    const optionalFirst = availableMigrations(reached).reverse();

    expect(names(orderAvailableMigrations(optionalFirst))).toEqual(['should', 'older', 'could']);
  });

  it('counts each level in one line', () => {
    expect(availableMigrationsLine(availableMigrations(reached))).toBe(
      '1 recommended and 2 optional migrations are available - run et migrations',
    );
  });

  it('leaves out a level with no migration', () => {
    const optional = availableMigrations({ ...reached, installed: '5.0.0-next.49' }).filter(
      (entry) => entry.migration.level === 'optional',
    );

    expect(availableMigrationsLine(optional)).toBe('1 optional migration is available - run et migrations');
  });

  it('prints nothing when none are available', () => {
    expect(availableMigrationsLine([])).toBeUndefined();
  });
});

describe('orderMigrations', () => {
  it('runs the oldest version first', () => {
    const ordered = orderMigrations([
      { packageName: '@ethlete/core', migration: migration({ name: 'second', version: '5.1.0' }) },
      { packageName: '@ethlete/core', migration: migration({ name: 'first', version: '5.0.0' }) },
    ]);

    expect(ordered.map((entry) => entry.migration.name)).toEqual(['first', 'second']);
  });

  it('keeps the declared order for two migrations of one package and version', () => {
    const ordered = orderMigrations([
      { packageName: '@ethlete/cdk', migration: migration({ name: 'the-codemod' }) },
      { packageName: '@ethlete/cdk', migration: migration({ name: 'the-decisions', kind: 'assisted' }) },
    ]);

    expect(ordered.map((entry) => entry.migration.name)).toEqual(['the-codemod', 'the-decisions']);
  });

  it('runs the package others build on first, inside one version', () => {
    const ordered = orderMigrations([
      { packageName: '@ethlete/components', migration: migration({ name: 'components' }) },
      { packageName: '@ethlete/core', migration: migration({ name: 'core' }) },
      { packageName: '@ethlete/types', migration: migration({ name: 'types' }) },
    ]);

    expect(ordered.map((entry) => entry.migration.name)).toEqual(['types', 'core', 'components']);
  });
});

describe('newerMajorOnTag', () => {
  it('names the tag that holds a newer major than a stable target', () => {
    const newer = newerMajorOnTag({
      name: '@ethlete/core',
      version: '4.32.0',
      distTags: { latest: '4.32.0', next: '5.0.0-next.61' },
    });

    expect(newer).toEqual({ name: '@ethlete/core', tag: 'next', version: '5.0.0-next.61' });
    expect(newerMajorLine(newer!)).toContain('et update --tag next');
    expect(newerMajorLine(newer!)).toContain('/migrating-from-v4');
  });

  it('stays quiet when no tag holds a higher major', () => {
    expect(
      newerMajorOnTag({
        name: '@ethlete/core',
        version: '5.0.0-next.61',
        distTags: { latest: '4.32.0', next: '5.0.0-next.61' },
      }),
    ).toBeUndefined();
    expect(
      newerMajorOnTag({ name: '@ethlete/core', version: '4.30.0', distTags: { latest: '4.32.0' } }),
    ).toBeUndefined();
  });

  it('picks the newest of several higher-major tags', () => {
    expect(
      newerMajorOnTag({
        name: '@ethlete/query',
        version: '5.44.0',
        distTags: { latest: '5.44.0', beta: '6.0.0-beta.8', next: '6.0.0-next.54' },
      }),
    ).toEqual({ name: '@ethlete/query', tag: 'next', version: '6.0.0-next.54' });
  });
});
