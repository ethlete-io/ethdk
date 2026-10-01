import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATION_RECORD_FILE, readMigrationRecord, writeMigrationRun } from './migration-record';
import { migrationsCommand } from './migrations-command';
import { writePendingUpdate } from './pending';
import { SCAN_FILE_ENV } from './scan';
import { TASKS_DATA_FILE, UPDATE_DIR } from './tasks';

const spawnSync = vi.hoisted(() =>
  vi.fn<(binary: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => { status: number }>(),
);

const REAL_GIT = ['ls-files', 'rev-parse', 'status', 'add', 'commit', 'reset', 'check-ignore'];

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    spawnSync: (binary: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) =>
      binary === 'git' && REAL_GIT.includes(args[0] ?? '')
        ? actual.spawnSync(binary, args, options)
        : spawnSync(binary, args, options),
  };
});

const writeJson = (path: string, value: unknown) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value), 'utf8');
};

const gitIn = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const installQuery = (root: string, version: string) => {
  const query = join(root, 'node_modules', '@ethlete', 'query');

  writeJson(join(query, 'package.json'), {
    name: '@ethlete/query',
    version,
    ethlete: { migrations: './migrations.json' },
  });
  writeJson(join(query, 'migrations.json'), {
    migrations: [
      {
        name: 'prep-for-query-v3',
        version: '5.40.0',
        kind: 'auto',
        level: 'required',
        description: 'Prepare the legacy queries',
        generator: '@ethlete/query:prep-for-query-v3',
      },
      {
        name: 'to-query-v3',
        version: '5.42.0',
        kind: 'auto',
        level: 'optional',
        description: 'Move the legacy queries to v3',
        generator: '@ethlete/query:to-query-v3',
        docs: '/query/migrating-from-v2',
      },
      {
        name: 'deprecate-legacy-queries',
        version: '5.41.0',
        kind: 'assisted',
        level: 'recommended',
        description: 'Replace the deprecated legacy query APIs',
        instructions: './migrations/deprecate-legacy-queries.md',
      },
      {
        name: 'later',
        version: '5.50.0',
        kind: 'auto',
        level: 'optional',
        description: 'Not reached yet',
        generator: '@ethlete/query:later',
      },
    ],
  });
  mkdirSync(join(query, 'migrations'), { recursive: true });
  writeFileSync(join(query, 'migrations', 'deprecate-legacy-queries.md'), '## Replace them\n', 'utf8');
};

const addScannedMigration = (root: string) => {
  const path = join(root, 'node_modules', '@ethlete', 'query', 'migrations.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as { migrations: object[] };

  manifest.migrations.push({
    name: 'report-legacy-query-apis',
    version: '5.42.0',
    kind: 'auto',
    level: 'optional',
    description: 'List the legacy query APIs',
    generator: '@ethlete/query:report-legacy-query-apis',
    scan: '@ethlete/query:report-legacy-query-apis',
  });
  writeJson(path, manifest);
};

const scanReturns = (files: unknown) =>
  spawnSync.mockImplementation((_binary, args, options) => {
    const scanFile = options?.env?.[SCAN_FILE_ENV];

    if (args.includes('--dry-run') && scanFile) writeFileSync(scanFile, JSON.stringify(files), 'utf8');

    return { status: 0 };
  });

const makeRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-migrations-command-'));

  writeJson(join(root, 'package.json'), {
    name: 'app',
    packageManager: 'yarn@1.22.21',
    dependencies: { '@ethlete/query': '5.42.0' },
  });
  writeJson(join(root, 'nx.json'), {});
  writeJson(join(root, 'node_modules', 'nx', 'package.json'), {});
  installQuery(root, '5.42.0');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.ethlete/update/\n', 'utf8');
  gitIn(root, 'init', '--quiet');
  gitIn(root, 'config', 'user.email', 'test@example.com');
  gitIn(root, 'config', 'user.name', 'Test');
  gitIn(root, 'config', 'commit.gpgsign', 'false');
  gitIn(root, 'config', 'core.hooksPath', mkdtempSync(join(tmpdir(), 'cli-migrations-hooks-')));
  gitIn(root, 'add', '--all');
  gitIn(root, 'commit', '--quiet', '-m', 'initial');

  return root;
};

const logged = () =>
  vi
    .mocked(console.log)
    .mock.calls.map((call) => String(call[0]))
    .join('\n');

const errors = () =>
  vi
    .mocked(console.error)
    .mock.calls.map((call) => String(call[0]))
    .join('\n');

const generatorsRun = () =>
  spawnSync.mock.calls.flatMap(([, args]) => args.filter((arg) => arg.startsWith('@ethlete/query:')));

const subjects = (root: string) => gitIn(root, 'log', '--format=%s').trim().split('\n');

const lastCommitFiles = (root: string) => gitIn(root, 'show', '--name-only', '--format=', 'HEAD').trim().split('\n');

beforeEach(() => {
  spawnSync.mockReset();
  spawnSync.mockReturnValue({ status: 0 });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('et migrations', () => {
  it('lists the recommended and optional migrations the installed version reached, recommended first', () => {
    const root = makeRepo();

    expect(migrationsCommand({ argv: [], root })).toBe(0);
    expect(logged()).toBe(
      [
        '2 migrations are available:\n',
        '  recommended  @ethlete/query:deprecate-legacy-queries (assisted)',
        '    Replace the deprecated legacy query APIs',
        '    Run: et migrations run @ethlete/query:deprecate-legacy-queries\n',
        '  optional  @ethlete/query:to-query-v3 (auto)',
        '    Move the legacy queries to v3',
        '    Docs: https://ethlete-sdk-docs.web.app/query/migrating-from-v2',
        '    Run: et migrations run @ethlete/query:to-query-v3\n',
      ].join('\n'),
    );
  });

  it('leaves out a migration the record holds a run of', () => {
    const root = makeRepo();

    writeMigrationRun({
      root,
      packageName: '@ethlete/query',
      name: 'deprecate-legacy-queries',
      run: { version: '5.42.0', ranAt: 'then' },
    });

    migrationsCommand({ argv: [], root });

    expect(logged()).toContain('1 migration is available');
    expect(logged()).not.toContain('deprecate-legacy-queries');
  });

  it('says so when none is available', () => {
    const root = makeRepo();

    installQuery(root, '5.39.0');

    expect(migrationsCommand({ argv: [], root })).toBe(0);
    expect(logged()).toBe('No recommended or optional migration is available.');
  });

  it('shows the number of affected files next to a migration with a scan, and nothing next to one without', () => {
    const root = makeRepo();

    addScannedMigration(root);
    scanReturns(['libs/a.ts', 'libs/b.ts', 'libs/a.ts']);

    expect(migrationsCommand({ argv: [], root })).toBe(0);
    expect(logged()).toContain('  optional  @ethlete/query:report-legacy-query-apis (auto) - 2 affected files\n');
    expect(logged()).toContain('  optional  @ethlete/query:to-query-v3 (auto)\n');
    expect(spawnSync.mock.calls.map(([, args]) => args)).toEqual([
      ['nx', 'generate', '@ethlete/query:report-legacy-query-apis', '--interactive=false', '--dry-run'],
    ]);
  });

  it.each([
    ['exits non-zero', () => spawnSync.mockReturnValue({ status: 2 }), 'yarn exited with 2'],
    ['writes no result', () => spawnSync.mockReturnValue({ status: 0 }), 'the scan wrote no result'],
    ['writes something else than paths', () => scanReturns({ files: 3 }), 'the scan result is not a list of paths'],
  ])('lists a migration whose scan %s with an unknown count', (_, arrange, reason) => {
    const root = makeRepo();

    addScannedMigration(root);
    arrange();

    expect(migrationsCommand({ argv: [], root })).toBe(0);
    expect(logged()).toContain(
      `  optional  @ethlete/query:report-legacy-query-apis (auto) - affected files unknown (${reason})\n`,
    );
    expect(logged()).toContain('3 migrations are available');
  });

  it('reports a broken record', () => {
    const root = makeRepo();

    mkdirSync(join(root, '.ethlete'), { recursive: true });
    writeFileSync(join(root, MIGRATION_RECORD_FILE), '{ nope', 'utf8');

    expect(migrationsCommand({ argv: [], root })).toBe(1);
    expect(errors()).toContain(`${MIGRATION_RECORD_FILE} is not valid JSON.`);
  });
});

describe('et migrations run', () => {
  it('runs a codemod, records the run and commits both together', () => {
    const root = makeRepo();

    spawnSync.mockImplementation((_binary, args) => {
      if (args.includes('@ethlete/query:to-query-v3')) writeFileSync(join(root, 'changed.ts'), 'v3', 'utf8');

      return { status: 0 };
    });

    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3'], root })).toBe(0);
    expect(generatorsRun()).toEqual(['@ethlete/query:to-query-v3']);
    expect(readMigrationRecord(root).record['@ethlete/query:to-query-v3']).toEqual({
      version: '5.42.0',
      ranAt: expect.any(String),
    });
    expect(subjects(root)[0]).toBe('chore(deps): Apply the @ethlete/query to-query-v3 migration');
    expect(lastCommitFiles(root).sort()).toEqual(['.ethlete/migrations.json', 'changed.ts']);
  });

  it('writes the task of an assisted migration and commits the record', () => {
    const root = makeRepo();

    expect(migrationsCommand({ argv: ['run', '@ethlete/query:deprecate-legacy-queries'], root })).toBe(0);
    expect(generatorsRun()).toEqual([]);

    const data = JSON.parse(readFileSync(join(root, UPDATE_DIR, TASKS_DATA_FILE), 'utf8')) as {
      tasks: { name: string }[];
    };

    expect(data.tasks.map((task) => task.name)).toEqual(['deprecate-legacy-queries']);
    expect(existsSync(join(root, UPDATE_DIR, 'query-deprecate-legacy-queries.md'))).toBe(true);
    expect(subjects(root)[0]).toBe('chore(deps): Record the @ethlete/query deprecate-legacy-queries migration');
    expect(lastCommitFiles(root)).toEqual(['.ethlete/migrations.json']);
  });

  it('records nothing when the codemod fails', () => {
    const root = makeRepo();

    spawnSync.mockReturnValue({ status: 2 });

    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3'], root })).toBe(1);
    expect(existsSync(join(root, MIGRATION_RECORD_FILE))).toBe(false);
  });

  it.each([
    ['query:nope', '@ethlete/query 5.42.0 ships no migration "nope". Run `et migrations` to list the available ones.'],
    ['query:prep-for-query-v3', '@ethlete/query:prep-for-query-v3 is required, so `et update` runs it.'],
    ['query:later', '@ethlete/query:later lands in 5.50.0, and @ethlete/query is on 5.42.0. Run `et update` first.'],
    ['core:a-change', '@ethlete/core is not installed.'],
    ['to-query-v3', '"to-query-v3" names no migration. Name one as <package>:<name>.'],
  ])('refuses %s', (key, message) => {
    const root = makeRepo();

    expect(migrationsCommand({ argv: ['run', key], root })).toBe(1);
    expect(errors()).toContain(message);
    expect(generatorsRun()).toEqual([]);
  });

  it('refuses a migration that already ran', () => {
    const root = makeRepo();

    writeMigrationRun({
      root,
      packageName: '@ethlete/query',
      name: 'to-query-v3',
      run: { version: '5.42.0', ranAt: '2026-09-01' },
    });

    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3'], root })).toBe(1);
    expect(errors()).toContain('@ethlete/query:to-query-v3 already ran on 2026-09-01, with @ethlete/query 5.42.0.');
  });

  it('refuses to run while an update is unfinished', () => {
    const root = makeRepo();

    writePendingUpdate({ root, pending: { startedAt: 'then', packages: [] } });

    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3'], root })).toBe(1);
    expect(errors()).toContain('Run `et update --continue` to finish it first.');
  });

  it('refuses to run on a dirty tree without --force', () => {
    const root = makeRepo();

    writeFileSync(join(root, 'mine.ts'), 'my own work', 'utf8');

    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3'], root })).toBe(1);
    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3', '--force'], root })).toBe(0);
    expect(generatorsRun()).toEqual(['@ethlete/query:to-query-v3']);
  });

  it('commits nothing with --no-commit', () => {
    const root = makeRepo();

    expect(migrationsCommand({ argv: ['run', 'query:to-query-v3', '--no-commit'], root })).toBe(0);
    expect(subjects(root)).toEqual(['initial']);
    expect(existsSync(join(root, MIGRATION_RECORD_FILE))).toBe(true);
  });

  it('needs exactly one migration to run', () => {
    expect(migrationsCommand({ argv: ['run'], root: makeRepo() })).toBe(1);
    expect(errors()).toContain('run needs one migration, as <package>:<name>.');
  });
});
