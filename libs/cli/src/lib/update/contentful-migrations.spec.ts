import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readPackageMigrations } from './migration-manifest';
import { orderMigrations, pendingMigrations } from './plan';
import { compareVersions } from './semver';

const contentfulSource = join(__dirname, '../../../../contentful');
const docsSource = join(__dirname, '../../../../../apps/docs');
const packageName = '@ethlete/contentful';

const installedVersion = (
  JSON.parse(readFileSync(join(contentfulSource, 'package.json'), 'utf8')) as { version: string }
).version;

const nextPrerelease = (version: string) => version.replace(/\.(\d+)$/, (_, build: string) => `.${Number(build) + 1}`);

const installContentful = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-contentful-migrations-'));
  const target = join(root, 'node_modules', '@ethlete', 'contentful');

  mkdirSync(target, { recursive: true });

  for (const entry of ['package.json', 'migrations.json']) cpSync(join(contentfulSource, entry), join(target, entry));

  return root;
};

const generators = JSON.parse(readFileSync(join(contentfulSource, 'generators/generators.json'), 'utf8')) as {
  generators: Record<string, { factory: string; schema: string }>;
};

describe('the @ethlete/contentful migrations', () => {
  const { migrations, problems } = readPackageMigrations({ root: installContentful(), packageName });

  it('parse without problems', () => {
    expect(problems).toEqual([]);
  });

  it('run on the update from the published version to the next prerelease', () => {
    const pending = orderMigrations(
      pendingMigrations({
        packageMigrations: { packageName, migrations, problems },
        from: installedVersion,
        to: nextPrerelease(installedVersion),
      }),
    ).map((entry) => entry.migration.name);

    expect(pending).toContain('contentful-default-components');
  });

  it('name no version past the next prerelease, which an update would never reach', () => {
    const beyond = migrations.filter(
      (migration) => compareVersions(migration.version, nextPrerelease(installedVersion)) > 0,
    );

    expect(beyond.map((migration) => `${migration.name}@${migration.version}`)).toEqual([]);
  });

  it('name generators the package ships', () => {
    for (const migration of migrations.filter((entry) => entry.kind === 'auto')) {
      const [, generator = ''] = (migration.generator ?? '').split(':');
      const definition = generators.generators[generator];

      expect(definition, migration.name).toBeDefined();
      expect(existsSync(join(contentfulSource, 'generators', `${definition?.factory}.ts`)), migration.name).toBe(true);
      expect(existsSync(join(contentfulSource, 'generators', definition?.schema ?? '')), migration.name).toBe(true);
    }
  });

  it('link docs pages that exist', () => {
    for (const migration of migrations.filter((entry) => entry.docs !== undefined)) {
      expect(existsSync(join(docsSource, `${migration.docs?.replace(/\/$/, '/index')}.md`)), migration.name).toBe(true);
    }
  });
});
