import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readPackageMigrations } from './migration-manifest';
import { availableMigrations, pendingMigrations } from './plan';

const querySource = join(__dirname, '../../../../query');
const packageName = '@ethlete/query';

const installQuery = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-query-migrations-'));
  const target = join(root, 'node_modules', '@ethlete', 'query');

  mkdirSync(target, { recursive: true });

  for (const entry of ['package.json', 'migrations.json']) cpSync(join(querySource, entry), join(target, entry));

  return root;
};

const generators = JSON.parse(readFileSync(join(querySource, 'generators/generators.json'), 'utf8')) as {
  generators: Record<string, unknown>;
};

const shippedGenerator = (name: string | undefined) => {
  const [scope, generator = ''] = (name ?? '').split(':');

  return scope === packageName && generators.generators[generator] !== undefined;
};

describe('the @ethlete/query migrations', () => {
  const packageMigrations = readPackageMigrations({ root: installQuery(), packageName });
  const { migrations, problems } = packageMigrations;

  it('parse without problems', () => {
    expect(problems).toEqual([]);
  });

  it('name generators and scans the package ships', () => {
    for (const migration of migrations) {
      if (migration.kind === 'auto') expect(shippedGenerator(migration.generator)).toBe(true);
      if (migration.scan !== undefined) expect(shippedGenerator(migration.scan)).toBe(true);
    }
  });

  it('offer report-legacy-query-apis as an optional migration with a scan, which et update never runs', () => {
    const report = migrations.find((migration) => migration.name === 'report-legacy-query-apis');

    expect(report).toMatchObject({
      level: 'optional',
      generator: '@ethlete/query:report-legacy-query-apis',
      scan: '@ethlete/query:report-legacy-query-apis',
    });
    expect(
      pendingMigrations({ packageMigrations, from: '6.0.0-next.54', to: '6.0.0-next.55' }).map(
        (entry) => entry.migration.name,
      ),
    ).not.toContain('report-legacy-query-apis');
    expect(
      availableMigrations({ packageMigrations, installed: '6.0.0-next.55', record: {} }).map(
        (entry) => entry.migration.name,
      ),
    ).toContain('report-legacy-query-apis');
  });
});
