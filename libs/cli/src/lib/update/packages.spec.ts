import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { declaredEthletePackages, installedVersion, rangeFor, readManifest, writeRanges } from './packages';

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-packages-'));

const writeManifest = (root: string, manifest: unknown, indent = 2) =>
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(manifest, null, indent)}\n`, 'utf8');

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

describe('declaredEthletePackages', () => {
  it('finds the ethlete packages of every dependency field', () => {
    const root = makeRoot();
    const manifest = {
      dependencies: { '@ethlete/core': '^5.0.0', rxjs: '7.8.2' },
      devDependencies: { '@ethlete/cli': '2.1.0' },
      peerDependencies: { '@ethlete/types': '~2.0.0' },
    };

    writeManifest(root, manifest);
    install({ root, name: '@ethlete/core', version: '5.0.0' });

    expect(declaredEthletePackages({ root, manifest })).toEqual([
      {
        name: '@ethlete/core',
        field: 'dependencies',
        range: '^5.0.0',
        declaredVersion: '5.0.0',
        installedVersion: '5.0.0',
      },
      {
        name: '@ethlete/cli',
        field: 'devDependencies',
        range: '2.1.0',
        declaredVersion: '2.1.0',
        installedVersion: undefined,
      },
      {
        name: '@ethlete/types',
        field: 'peerDependencies',
        range: '~2.0.0',
        declaredVersion: '2.0.0',
        installedVersion: undefined,
      },
    ]);
  });

  it('reads no version from a range that holds none', () => {
    const root = makeRoot();
    const manifest = { dependencies: { '@ethlete/core': 'workspace:*' } };

    writeManifest(root, manifest);

    expect(declaredEthletePackages({ root, manifest })[0]?.declaredVersion).toBeUndefined();
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
        { name: '@ethlete/core', field: 'dependencies', range: '^5.1.0' },
        { name: '@ethlete/cli', field: 'devDependencies', range: '2.1.0' },
      ],
    });

    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).toEqual({
      dependencies: { '@ethlete/core': '^5.1.0' },
      devDependencies: { '@ethlete/cli': '2.1.0' },
    });
  });

  it('keeps the indentation and the trailing newline of the file', () => {
    const root = makeRoot();

    writeManifest(root, { dependencies: { '@ethlete/core': '^5.0.0' } }, 4);
    writeRanges({ root, writes: [{ name: '@ethlete/core', field: 'dependencies', range: '^5.1.0' }] });

    const written = readFileSync(join(root, 'package.json'), 'utf8');

    expect(written).toContain('\n    "dependencies"');
    expect(written.endsWith('\n')).toBe(true);
  });

  it('leaves a field the manifest does not have alone', () => {
    const root = makeRoot();

    writeManifest(root, { dependencies: { '@ethlete/core': '^5.0.0' } });
    writeRanges({ root, writes: [{ name: '@ethlete/cli', field: 'devDependencies', range: '2.1.0' }] });

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
