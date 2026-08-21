import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { Migration } from './migration-manifest';
import { PackageManager } from './package-manager';
import { generatorArgs, hasNx, manualGeneratorCommand, runPendingMigrations } from './run-migrations';

const yarn: PackageManager = { name: 'yarn', install: ['yarn', 'install'], run: ['yarn'] };

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-run-migrations-'));

const migration = (overrides: Partial<Migration> = {}): Migration => ({
  name: 'a-change',
  version: '5.0.0',
  kind: 'auto',
  description: 'Rewrite something',
  generator: '@ethlete/core:migrate-a-change',
  ...overrides,
});

describe('generatorArgs', () => {
  it('runs the generator without asking anything', () => {
    expect(generatorArgs({ migration: migration(), dryRun: false })).toEqual([
      'generate',
      '@ethlete/core:migrate-a-change',
      '--interactive=false',
    ]);
  });

  it('passes the declared options as flags', () => {
    expect(generatorArgs({ migration: migration({ options: { skipFormat: true, depth: 2 } }), dryRun: false })).toEqual(
      ['generate', '@ethlete/core:migrate-a-change', '--interactive=false', '--skipFormat=true', '--depth=2'],
    );
  });

  it('adds --dry-run for a dry run', () => {
    expect(generatorArgs({ migration: migration(), dryRun: true })).toContain('--dry-run');
  });
});

describe('manualGeneratorCommand', () => {
  it('is the command a developer can copy', () => {
    expect(manualGeneratorCommand({ manager: yarn, migration: migration() })).toBe(
      'yarn nx generate @ethlete/core:migrate-a-change --interactive=false',
    );
  });
});

describe('hasNx', () => {
  it('is false without nx installed', () => {
    expect(hasNx(makeRoot())).toBe(false);
  });

  it('is false with nx installed but no workspace config', () => {
    const root = makeRoot();

    mkdirSync(join(root, 'node_modules', 'nx'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'nx', 'package.json'), '{}', 'utf8');

    expect(hasNx(root)).toBe(false);
  });
});

describe('runPendingMigrations', () => {
  it('leaves a manual migration to the report', () => {
    const outcomes = runPendingMigrations({
      root: makeRoot(),
      manager: yarn,
      pending: [{ packageName: '@ethlete/core', migration: migration({ kind: 'manual', generator: undefined }) }],
      dryRun: false,
    });

    expect(outcomes[0]?.state).toBe('task');
  });

  it('reports an auto migration as unsupported when the repo has no nx', () => {
    const outcomes = runPendingMigrations({
      root: makeRoot(),
      manager: yarn,
      pending: [{ packageName: '@ethlete/core', migration: migration() }],
      dryRun: false,
    });

    expect(outcomes[0]).toMatchObject({ state: 'unsupported' });
  });
});
