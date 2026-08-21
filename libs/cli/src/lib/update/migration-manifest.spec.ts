import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { instructionsPath, readPackageMigrations } from './migration-manifest';

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-migrations-'));

const installPackage = (options: {
  root: string;
  name?: string;
  packageJson?: unknown;
  manifest?: unknown;
  manifestFileName?: string;
}) => {
  const { root, name = '@ethlete/core', packageJson, manifest, manifestFileName = 'migrations.json' } = options;
  const directory = join(root, 'node_modules', ...name.split('/'));

  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify(packageJson ?? { name, version: '5.0.0', ethlete: { migrations: `./${manifestFileName}` } }),
    'utf8',
  );

  if (manifest !== undefined) {
    writeFileSync(join(directory, manifestFileName), JSON.stringify(manifest), 'utf8');
  }

  return directory;
};

const entry = (overrides: Record<string, unknown> = {}) => ({
  name: 'a-change',
  version: '5.0.0-next.46',
  kind: 'auto',
  description: 'Rewrite something',
  generator: '@ethlete/core:migrate-a-change',
  ...overrides,
});

describe('readPackageMigrations', () => {
  it('reads the entries a package ships', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { migrations: [entry()] } });

    const read = readPackageMigrations({ root, packageName: '@ethlete/core' });

    expect(read.problems).toEqual([]);
    expect(read.migrations).toEqual([
      {
        name: 'a-change',
        version: '5.0.0-next.46',
        kind: 'auto',
        description: 'Rewrite something',
        generator: '@ethlete/core:migrate-a-change',
        options: undefined,
        instructions: undefined,
        docs: undefined,
      },
    ]);
  });

  it('reports a package that is not installed', () => {
    expect(readPackageMigrations({ root: makeRoot(), packageName: '@ethlete/core' }).problems).toEqual([
      '@ethlete/core is not installed.',
    ]);
  });

  it('reads nothing from a package that declares no manifest', () => {
    const root = makeRoot();

    installPackage({ root, packageJson: { name: '@ethlete/core', version: '5.0.0' } });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' })).toMatchObject({
      migrations: [],
      problems: [],
    });
  });

  it('reports a manifest the package points at but does not ship', () => {
    const root = makeRoot();

    installPackage({ root });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems[0]).toContain('which is missing');
  });

  it('reports a manifest without a migrations array', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { entries: [] } });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems).toEqual([
      '@ethlete/core migrations.json has no "migrations" array.',
    ]);
  });

  it('reports an entry with an invalid version', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { migrations: [entry({ version: 'next' })] } });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems).toEqual([
      '@ethlete/core migrations.json "a-change" has an invalid version "next".',
    ]);
  });

  it('reports an unknown kind', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { migrations: [entry({ kind: 'codemod' })] } });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems[0]).toContain('has kind "codemod"');
  });

  it('reports an auto entry with no generator', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { migrations: [entry({ generator: undefined })] } });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems).toEqual([
      '@ethlete/core migrations.json "a-change" is auto but names no "generator".',
    ]);
  });

  it('reports an assisted entry with no instructions', () => {
    const root = makeRoot();

    installPackage({
      root,
      manifest: { migrations: [entry({ kind: 'assisted', generator: undefined })] },
    });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems).toEqual([
      '@ethlete/core migrations.json "a-change" is assisted but names no "instructions" file.',
    ]);
  });

  it('reports the same name twice', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { migrations: [entry(), entry()] } });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).problems).toEqual([
      '@ethlete/core migrations.json declares "a-change" twice.',
    ]);
  });

  it('keeps the good entries of a manifest that also holds a bad one', () => {
    const root = makeRoot();

    installPackage({ root, manifest: { migrations: [entry({ name: 'good' }), entry({ name: '' })] } });

    const read = readPackageMigrations({ root, packageName: '@ethlete/core' });

    expect(read.migrations.map((migration) => migration.name)).toEqual(['good']);
    expect(read.problems).toEqual(['@ethlete/core migrations.json entry 1 has no "name".']);
  });

  it('keeps only the option values a flag can carry', () => {
    const root = makeRoot();

    installPackage({
      root,
      manifest: { migrations: [entry({ options: { skipFormat: true, depth: 2, mode: 'all', extra: { a: 1 } } })] },
    });

    expect(readPackageMigrations({ root, packageName: '@ethlete/core' }).migrations[0]?.options).toEqual({
      skipFormat: true,
      depth: 2,
      mode: 'all',
    });
  });
});

describe('instructionsPath', () => {
  it('resolves a path next to the manifest', () => {
    expect(
      instructionsPath({
        manifestPath: '/pkg/migrations.json',
        migration: {
          name: 'a',
          version: '1.0.0',
          kind: 'manual',
          description: 'x',
          instructions: './migrations/a.md',
        },
      }),
    ).toBe('/pkg/migrations/a.md');
  });

  it('has no path for a migration that ships none', () => {
    expect(
      instructionsPath({
        manifestPath: '/pkg/migrations.json',
        migration: { name: 'a', version: '1.0.0', kind: 'manual', description: 'x' },
      }),
    ).toBeUndefined();
  });
});
