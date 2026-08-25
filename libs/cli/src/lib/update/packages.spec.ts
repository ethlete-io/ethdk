import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  declaredEthletePackages,
  findManifests,
  installedVersion,
  newestDeclaredVersion,
  rangeFor,
  readManifest,
  writeRanges,
} from './packages';

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-packages-'));

const writeManifest = (root: string, manifest: unknown, relativePath = 'package.json', indent = 2) => {
  const path = join(root, relativePath);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, indent)}\n`, 'utf8');
};

const install = (options: { root: string; name: string; version: string }) => {
  const directory = join(options.root, 'node_modules', ...options.name.split('/'));

  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: options.name, version: options.version }));
};

describe('readManifest', () => {
  it('reads nothing when there is no manifest', () => {
    expect(readManifest(makeRoot())).toBeUndefined();
  });

  it('reads nothing from a manifest that is not valid json', () => {
    const root = makeRoot();

    writeFileSync(join(root, 'package.json'), '{ not json', 'utf8');

    expect(readManifest(root)).toBeUndefined();
  });
});

describe('findManifests', () => {
  it('finds every manifest, root first', () => {
    const root = makeRoot();

    writeManifest(root, { name: 'root' });
    writeManifest(root, { name: 'auth' }, join('libs', 'domain', 'auth', 'package.json'));
    writeManifest(root, { name: 'app' }, join('apps', 'web', 'package.json'));

    expect(findManifests(root)).toEqual(['package.json', 'apps/web/package.json', 'libs/domain/auth/package.json']);
  });

  it('skips node_modules, dist and dot directories', () => {
    const root = makeRoot();

    writeManifest(root, { name: 'root' });
    writeManifest(root, { name: 'installed' }, join('node_modules', 'a', 'package.json'));
    writeManifest(root, { name: 'built' }, join('dist', 'libs', 'a', 'package.json'));
    writeManifest(root, { name: 'cached' }, join('.nx', 'cache', 'package.json'));

    expect(findManifests(root)).toEqual(['package.json']);
  });
});

describe('declaredEthletePackages', () => {
  it('finds the ethlete packages of every dependency field', () => {
    const root = makeRoot();

    writeManifest(root, {
      dependencies: { '@ethlete/core': '^5.0.0', rxjs: '7.8.2' },
      devDependencies: { '@ethlete/cli': '2.1.0' },
      peerDependencies: { '@ethlete/types': '~2.0.0' },
    });
    install({ root, name: '@ethlete/core', version: '5.0.0' });

    expect(declaredEthletePackages({ root })).toEqual([
      {
        name: '@ethlete/core',
        installedVersion: '5.0.0',
        sites: [
          {
            manifestPath: 'package.json',
            field: 'dependencies',
            range: '^5.0.0',
            declaredVersion: '5.0.0',
          },
        ],
      },
      {
        name: '@ethlete/cli',
        installedVersion: undefined,
        sites: [
          {
            manifestPath: 'package.json',
            field: 'devDependencies',
            range: '2.1.0',
            declaredVersion: '2.1.0',
          },
        ],
      },
      {
        name: '@ethlete/types',
        installedVersion: undefined,
        sites: [
          {
            manifestPath: 'package.json',
            field: 'peerDependencies',
            range: '~2.0.0',
            declaredVersion: '2.0.0',
          },
        ],
      },
    ]);
  });

  it('gathers one package across every manifest that declares it', () => {
    const root = makeRoot();

    writeManifest(root, { dependencies: { '@ethlete/core': '^5.0.0' } });
    writeManifest(
      root,
      { peerDependencies: { '@ethlete/core': '5.0.0' } },
      join('libs', 'domain', 'auth', 'package.json'),
    );

    const [entry] = declaredEthletePackages({ root });

    expect(entry?.sites).toEqual([
      { manifestPath: 'package.json', field: 'dependencies', range: '^5.0.0', declaredVersion: '5.0.0' },
      {
        manifestPath: 'libs/domain/auth/package.json',
        field: 'peerDependencies',
        range: '5.0.0',
        declaredVersion: '5.0.0',
      },
    ]);
  });

  it('reads no version from a range that holds none', () => {
    const root = makeRoot();

    writeManifest(root, { dependencies: { '@ethlete/core': 'workspace:*' } });

    expect(declaredEthletePackages({ root })[0]?.sites[0]?.declaredVersion).toBeUndefined();
  });
});

describe('newestDeclaredVersion', () => {
  it('takes the newest version any site declares', () => {
    expect(
      newestDeclaredVersion([
        {
          manifestPath: 'a/package.json',
          field: 'dependencies',
          range: '5.0.0-next.10',
          declaredVersion: '5.0.0-next.10',
        },
        {
          manifestPath: 'package.json',
          field: 'dependencies',
          range: '^5.0.0-next.60',
          declaredVersion: '5.0.0-next.60',
        },
      ]),
    ).toBe('5.0.0-next.60');
  });

  it('takes nothing when no site declares a version', () => {
    expect(
      newestDeclaredVersion([{ manifestPath: 'package.json', field: 'dependencies', range: 'workspace:*' }]),
    ).toBeUndefined();
  });
});

describe('installedVersion', () => {
  it('reads the version out of node_modules', () => {
    const root = makeRoot();

    install({ root, name: '@ethlete/core', version: '5.0.0-next.55' });

    expect(installedVersion(root, '@ethlete/core')).toBe('5.0.0-next.55');
  });

  it('reads nothing for a package that is not installed', () => {
    expect(installedVersion(makeRoot(), '@ethlete/core')).toBeUndefined();
  });
});

describe('writeRanges', () => {
  it('writes a new range into the field it came from', () => {
    const root = makeRoot();

    writeManifest(root, {
      dependencies: { '@ethlete/core': '^5.0.0' },
      devDependencies: { '@ethlete/cli': '2.0.0' },
    });

    writeRanges({
      root,
      writes: [
        { name: '@ethlete/core', manifestPath: 'package.json', field: 'dependencies', range: '^5.1.0' },
        { name: '@ethlete/cli', manifestPath: 'package.json', field: 'devDependencies', range: '2.1.0' },
      ],
    });

    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).toEqual({
      dependencies: { '@ethlete/core': '^5.1.0' },
      devDependencies: { '@ethlete/cli': '2.1.0' },
    });
  });

  it('writes every manifest a package is declared in, and names them', () => {
    const root = makeRoot();
    const nested = join('libs', 'domain', 'auth', 'package.json');

    writeManifest(root, { dependencies: { '@ethlete/core': '^5.0.0' } });
    writeManifest(root, { peerDependencies: { '@ethlete/core': '5.0.0' } }, nested);

    const written = writeRanges({
      root,
      writes: [
        { name: '@ethlete/core', manifestPath: 'package.json', field: 'dependencies', range: '^5.1.0' },
        {
          name: '@ethlete/core',
          manifestPath: 'libs/domain/auth/package.json',
          field: 'peerDependencies',
          range: '5.1.0',
        },
      ],
    });

    expect(written).toEqual(['package.json', 'libs/domain/auth/package.json']);
    expect(JSON.parse(readFileSync(join(root, nested), 'utf8'))).toEqual({
      peerDependencies: { '@ethlete/core': '5.1.0' },
    });
  });

  it('keeps the indentation and the trailing newline of the file', () => {
    const root = makeRoot();

    writeManifest(root, { dependencies: { '@ethlete/core': '^5.0.0' } }, 'package.json', 4);
    writeRanges({
      root,
      writes: [{ name: '@ethlete/core', manifestPath: 'package.json', field: 'dependencies', range: '^5.1.0' }],
    });

    const written = readFileSync(join(root, 'package.json'), 'utf8');

    expect(written).toContain('\n    "dependencies"');
    expect(written.endsWith('\n')).toBe(true);
  });

  it('leaves a field the manifest does not have alone', () => {
    const root = makeRoot();

    writeManifest(root, { dependencies: { '@ethlete/core': '^5.0.0' } });
    writeRanges({
      root,
      writes: [{ name: '@ethlete/cli', manifestPath: 'package.json', field: 'devDependencies', range: '2.1.0' }],
    });

    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).toEqual({
      dependencies: { '@ethlete/core': '^5.0.0' },
    });
  });
});

describe('rangeFor', () => {
  it('keeps the prefix of the declared range', () => {
    expect(rangeFor({ current: '^5.0.0', version: '5.1.0' })).toBe('^5.1.0');
    expect(rangeFor({ current: '~5.0.0', version: '5.1.0' })).toBe('~5.1.0');
    expect(rangeFor({ current: '5.0.0', version: '5.1.0' })).toBe('5.1.0');
  });

  it('refuses a range it cannot rewrite', () => {
    expect(rangeFor({ current: '>=5 <6', version: '5.1.0' })).toBeUndefined();
  });
});
