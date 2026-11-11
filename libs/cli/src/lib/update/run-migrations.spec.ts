import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { Migration } from './migration-manifest';
import { PackageManager } from './package-manager';
import {
  generatorArgs,
  hasNx,
  manualGeneratorCommand,
  missingRequirements,
  runPendingMigrations,
} from './run-migrations';
import { gitExec } from '../git-test-env.fixtures';

const yarn: PackageManager = { name: 'yarn', install: ['yarn', 'install'], run: ['yarn'] };

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-run-migrations-'));

const migration = (overrides: Partial<Migration> = {}): Migration => ({
  name: 'a-change',
  version: '5.0.0',
  kind: 'auto',
  level: 'required',
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

describe('missingRequirements', () => {
  const withCore = (version: string) => {
    const root = makeRoot();

    mkdirSync(join(root, 'node_modules', '@ethlete', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules', '@ethlete', 'core', 'package.json'),
      JSON.stringify({ name: '@ethlete/core', version, peerDependencies: { 'ts-morph': '^28.0.0' } }),
    );

    return root;
  };

  const pending = (overrides: Partial<Migration>) => [
    { packageName: '@ethlete/core', migration: migration(overrides) },
  ];

  it('adds an @ethlete package at the dist tag of the migrating package', () => {
    expect(
      missingRequirements({ root: withCore('5.0.0-next.46'), pending: pending({ adds: ['@ethlete/extra'] }) }),
    ).toEqual(['@ethlete/extra@next']);
    expect(missingRequirements({ root: withCore('5.2.0'), pending: pending({ adds: ['@ethlete/extra'] }) })).toEqual([
      '@ethlete/extra@latest',
    ]);
  });

  it('adds an addsWhenFound package only when a source file names one of its identifiers', () => {
    const root = withCore('5.0.0-next.46');
    const entry = pending({ addsWhenFound: { '@ethlete/extra': ['ExtraComponent'] } });

    gitExec(['init', '-q'], { cwd: root });
    writeFileSync(join(root, 'app.ts'), 'export const a = 1;\n');

    expect(missingRequirements({ root, pending: entry })).toEqual([]);

    writeFileSync(join(root, 'page.ts'), "import { ExtraComponent } from 'somewhere';\n");

    expect(missingRequirements({ root, pending: entry })).toEqual(['@ethlete/extra@next']);
  });

  it('keeps the peer range for a required package and skips an installed one', () => {
    const root = withCore('5.0.0-next.46');

    mkdirSync(join(root, 'node_modules', '@ethlete', 'extra'), { recursive: true });
    writeFileSync(join(root, 'node_modules', '@ethlete', 'extra', 'package.json'), '{}');

    expect(
      missingRequirements({ root, pending: pending({ requires: ['ts-morph'], adds: ['@ethlete/extra'] }) }),
    ).toEqual(['ts-morph@^28.0.0']);
  });
});
