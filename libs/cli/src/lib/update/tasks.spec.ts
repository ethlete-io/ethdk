import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { Migration } from './migration-manifest';
import { PackageManager } from './package-manager';
import { PendingMigration } from './plan';
import { MigrationOutcome } from './run-migrations';
import {
  TASKS_DATA_FILE,
  TASKS_FILE,
  UPDATE_DIR,
  collectTasks,
  renderTaskFile,
  renderTasks,
  taskFileName,
  writeUpdateTasks,
} from './tasks';

const yarn: PackageManager = { name: 'yarn', install: ['yarn', 'install'], run: ['yarn'] };

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-tasks-'));

const migration = (overrides: Partial<Migration> = {}): Migration => ({
  name: 'a-change',
  version: '5.0.0',
  kind: 'auto',
  description: 'Rewrite something',
  generator: '@ethlete/core:migrate-a-change',
  ...overrides,
});

const pending = (overrides: Partial<PendingMigration> = {}): PendingMigration => ({
  packageName: '@ethlete/core',
  migration: migration(),
  ...overrides,
});

const outcome = (overrides: Partial<MigrationOutcome> = {}): MigrationOutcome => ({
  pending: pending(),
  state: 'applied',
  ...overrides,
});

describe('taskFileName', () => {
  it('names a file after the package and the migration', () => {
    expect(taskFileName({ packageName: '@ethlete/core', name: 'a-change' })).toBe('core-a-change.md');
  });
});

describe('collectTasks', () => {
  it('takes a manual migration', () => {
    const tasks = collectTasks({
      outcomes: [
        outcome({
          pending: pending({ migration: migration({ kind: 'manual', generator: undefined, docs: '/core/theming' }) }),
          state: 'task',
        }),
      ],
      manager: yarn,
    });

    expect(tasks).toEqual([
      {
        packageName: '@ethlete/core',
        name: 'a-change',
        version: '5.0.0',
        kind: 'manual',
        description: 'Rewrite something',
        instructionsFile: undefined,
        docsUrl: 'https://ethlete-sdk-docs.web.app/core/theming',
      },
    ]);
  });

  it('turns an unsupported codemod into a command to run', () => {
    const tasks = collectTasks({ outcomes: [outcome({ state: 'unsupported' })], manager: yarn });

    expect(tasks[0]).toMatchObject({
      kind: 'unsupported',
      command: 'yarn nx generate @ethlete/core:migrate-a-change --interactive=false',
    });
  });

  it('names the instructions file of a migration that ships one', () => {
    const tasks = collectTasks({
      outcomes: [
        outcome({
          pending: pending({
            migration: migration({ kind: 'assisted', generator: undefined, instructions: './migrations/a.md' }),
            manifestPath: '/pkg/migrations.json',
          }),
          state: 'task',
        }),
      ],
      manager: yarn,
    });

    expect(tasks[0]?.instructionsFile).toBe(join(UPDATE_DIR, 'core-a-change.md'));
  });

  it('takes nothing from a codemod that applied', () => {
    expect(collectTasks({ outcomes: [outcome()], manager: yarn })).toEqual([]);
  });
});

describe('renderTasks', () => {
  it('reports the versions, the codemods and the tasks', () => {
    const report = renderTasks({
      updates: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
      outcomes: [outcome()],
      tasks: [
        {
          packageName: '@ethlete/core',
          name: 'decide-this',
          version: '5.1.0',
          kind: 'manual',
          description: 'Pick a colour',
          docsUrl: 'https://ethlete-sdk-docs.web.app/core/theming',
        },
      ],
    });

    expect(report).toContain('- `@ethlete/core`: 5.0.0 → 5.1.0');
    expect(report).toContain('## Changes that need a decision');
    expect(report).toContain('### @ethlete/core — decide-this');
    expect(report).toContain('https://ethlete-sdk-docs.web.app/core/theming');
  });

  it('says so when nothing is left', () => {
    const report = renderTasks({
      updates: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
      outcomes: [outcome()],
      tasks: [],
    });

    expect(report).toContain('Nothing else needs a decision.');
  });

  it('reports a codemod that failed', () => {
    const report = renderTasks({
      updates: [{ name: '@ethlete/core', to: '5.1.0' }],
      outcomes: [outcome({ state: 'failed', reason: 'yarn exited with 1' })],
      tasks: [],
    });

    expect(report).toContain('yarn exited with 1');
  });
});

describe('renderTaskFile', () => {
  it('puts what moved above the instructions', () => {
    const file = renderTaskFile({
      task: {
        packageName: '@ethlete/core',
        name: 'a-change',
        version: '5.1.0',
        kind: 'assisted',
        description: 'Rewrite something',
        docsUrl: 'https://ethlete-sdk-docs.web.app/core',
      },
      instructions: '# Do this\n\nStep one.',
    });

    expect(file).toContain('- Package: `@ethlete/core`');
    expect(file).toContain('- Landed in: 5.1.0');
    expect(file).toContain('Hand this file to an agent');
    expect(file).toContain('# Do this');
  });

  it('leaves the agent line out of a manual task', () => {
    const file = renderTaskFile({
      task: {
        packageName: '@ethlete/core',
        name: 'a-change',
        version: '5.1.0',
        kind: 'manual',
        description: 'Rewrite something',
      },
      instructions: 'Step one.',
    });

    expect(file).not.toContain('Hand this file to an agent');
  });
});

describe('writeUpdateTasks', () => {
  const instructionsFixture = (body: string) => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'cli-tasks-pkg-'));

    mkdirSync(join(packageRoot, 'migrations'), { recursive: true });
    writeFileSync(join(packageRoot, 'migrations', 'a.md'), body, 'utf8');

    return join(packageRoot, 'migrations.json');
  };

  it('writes the report, the data file and one file per task', () => {
    const root = makeRoot();
    const manifestPath = instructionsFixture('Ask the designer which colour.');

    const written = writeUpdateTasks({
      root,
      updates: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
      outcomes: [
        outcome({
          pending: pending({
            migration: migration({ kind: 'manual', generator: undefined, instructions: './migrations/a.md' }),
            manifestPath,
          }),
          state: 'task',
        }),
      ],
      manager: yarn,
      generatedAt: '2026-08-21T00:00:00.000Z',
    });

    expect(readFileSync(join(root, written.reportPath), 'utf8')).toContain('## Changes that need a decision');
    expect(readFileSync(join(root, UPDATE_DIR, 'core-a-change.md'), 'utf8')).toContain(
      'Ask the designer which colour.',
    );
    expect(JSON.parse(readFileSync(join(root, written.dataPath), 'utf8'))).toMatchObject({
      generatedAt: '2026-08-21T00:00:00.000Z',
      updates: [{ package: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
      tasks: [{ name: 'a-change', kind: 'manual' }],
    });
    expect(written.reportPath).toBe(join(UPDATE_DIR, TASKS_FILE));
    expect(written.dataPath).toBe(join(UPDATE_DIR, TASKS_DATA_FILE));
  });

  it('records what applied and what failed', () => {
    const root = makeRoot();

    const written = writeUpdateTasks({
      root,
      updates: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
      outcomes: [
        outcome(),
        outcome({ pending: pending({ migration: migration({ name: 'broken' }) }), state: 'failed', reason: 'exit 1' }),
      ],
      manager: yarn,
      generatedAt: '2026-08-21T00:00:00.000Z',
    });

    const data = JSON.parse(readFileSync(join(root, written.dataPath), 'utf8'));

    expect(data.applied).toEqual([
      { package: '@ethlete/core', name: 'a-change', generator: '@ethlete/core:migrate-a-change' },
    ]);
    expect(data.failed).toEqual([{ package: '@ethlete/core', name: 'broken', reason: 'exit 1' }]);
  });
});
