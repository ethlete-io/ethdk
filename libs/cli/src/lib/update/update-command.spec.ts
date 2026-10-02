import { execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeMigrationRun } from './migration-record';
import { PENDING_FILE, readPendingUpdate, writePendingUpdate } from './pending';
import { TASKS_DATA_FILE, TASKS_FILE, UPDATE_DIR } from './tasks';
import { updateCommand } from './update-command';

const spawnSync = vi.hoisted(() =>
  vi.fn<(binary: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) => { status: number }>(),
);

const REAL_GIT = ['ls-files', 'rev-parse', 'status', 'add', 'commit', 'reset'];

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    spawnSync: (binary: string, args: string[], options?: { env?: NodeJS.ProcessEnv }) =>
      binary === 'git' && REAL_GIT.includes(args[0] ?? '')
        ? actual.spawnSync(binary, args, options)
        : spawnSync(binary, args, options),
    spawn: (command: string, options?: { env?: NodeJS.ProcessEnv }) => {
      const child = Object.assign(new EventEmitter(), { pid: undefined, exitCode: null });
      const { status } = spawnSync(command, options as unknown as string[]);

      process.nextTick(() => child.emit('exit', status));

      return child;
    },
  };
});

const writeJson = (path: string, value: unknown) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value), 'utf8');
};

const makeRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-update-command-'));
  const core = join(root, 'node_modules', '@ethlete', 'core');

  writeJson(join(root, 'package.json'), {
    name: 'app',
    packageManager: 'yarn@1.22.21',
    dependencies: { '@ethlete/core': '5.1.0' },
  });
  writeJson(join(root, 'nx.json'), {});
  writeJson(join(root, 'node_modules', 'nx', 'package.json'), {});
  writeJson(join(core, 'package.json'), {
    name: '@ethlete/core',
    version: '5.1.0',
    ethlete: { migrations: './migrations.json' },
  });
  writeJson(join(core, 'migrations.json'), {
    migrations: ['first', 'second'].map((name) => ({
      name,
      version: '5.1.0',
      kind: 'auto',
      description: `Rewrite ${name}`,
      generator: `@ethlete/core:${name}`,
    })),
  });
  writePendingUpdate({
    root,
    pending: { startedAt: 'then', packages: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }] },
  });

  return root;
};

const generatorsRun = () =>
  spawnSync.mock.calls.flatMap(([, args]) => args.filter((arg) => arg.startsWith('@ethlete/core:')));

beforeEach(() => {
  spawnSync.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const stubRegistry = (latest: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ 'dist-tags': { latest }, versions: { [latest]: {} } }))),
  );

describe('et update under yarn run', () => {
  it('does not hand the registry yarn 1 exports to the install', async () => {
    const root = makeRepo();

    rmSync(join(root, UPDATE_DIR), { recursive: true });
    stubRegistry('5.2.0');
    vi.stubEnv('npm_lifecycle_event', 'et');
    vi.stubEnv('npm_config_registry', 'https://registry.yarnpkg.com');
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: [], root })).toBe(0);

    const install = spawnSync.mock.calls.find(([binary, args]) => binary === 'yarn' && args[0] === 'install');

    expect(install?.[2]?.env).toBeDefined();
    expect(install?.[2]?.env).not.toHaveProperty('npm_config_registry');
    expect(install?.[2]?.env).toHaveProperty('npm_lifecycle_event', 'et');
  });
});

describe('an update that moves @ethlete/cli', () => {
  it('hands the migrations to the installed CLI', async () => {
    const root = makeRepo();

    rmSync(join(root, UPDATE_DIR), { recursive: true });
    writeJson(join(root, 'package.json'), {
      name: 'app',
      packageManager: 'yarn@1.22.21',
      devDependencies: { '@ethlete/cli': '2.0.0' },
    });
    writeJson(join(root, 'node_modules', '@ethlete', 'cli', 'package.json'), {
      name: '@ethlete/cli',
      version: '2.0.0',
    });
    stubRegistry('2.1.0');
    spawnSync.mockImplementation((_binary, args) => ({ status: args[0] === 'et' ? 4 : 0 }));

    expect(await updateCommand({ argv: ['--ai'], root: withAgent(root) })).toBe(4);
    expect(
      spawnSync.mock.calls
        .map(([binary, args]) => [binary, ...args])
        .filter(([binary, first]) => binary === 'yarn' && first !== 'install'),
    ).toEqual([['yarn', 'et', 'update', '--continue', '--ai']]);
  });
});

describe('the migrations an update does not run', () => {
  const withLevels = (root: string) =>
    writeJson(join(root, 'node_modules', '@ethlete', 'core', 'migrations.json'), {
      migrations: [
        { name: 'must', level: 'required' },
        { name: 'should', level: 'recommended' },
        { name: 'could', level: 'optional' },
        { name: 'might', level: 'optional' },
      ].map(({ name, level }) => ({
        name,
        level,
        version: '5.1.0',
        kind: 'auto',
        description: `Rewrite ${name}`,
        generator: `@ethlete/core:${name}`,
      })),
    });

  it('runs only the required one and points at the rest', async () => {
    const root = makeRepo();

    withLevels(root);
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(generatorsRun()).toEqual(['@ethlete/core:must']);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('1 recommended and 2 optional migrations are available - run et migrations'),
    );
  });

  it('leaves out a migration the record holds a run of', async () => {
    const root = makeRepo();

    withLevels(root);
    writeMigrationRun({ root, packageName: '@ethlete/core', name: 'might', run: { version: '5.1.0', ranAt: 'then' } });
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('1 recommended and 1 optional migrations are available - run et migrations'),
    );
  });

  it('prints no line when every migration is required', async () => {
    const root = makeRepo();

    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('run et migrations'));
  });
});

describe('et update --continue', () => {
  it('does not run a codemod again that applied in the earlier run', async () => {
    const root = makeRepo();

    spawnSync.mockImplementation((_binary, args) => ({
      status: args.includes('@ethlete/core:second') ? 1 : 0,
    }));

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(1);
    expect(readPendingUpdate(root)?.finished).toEqual([{ packageName: '@ethlete/core', name: 'first' }]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('et update --continue` again'));

    spawnSync.mockReset();
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(generatorsRun()).toEqual(['@ethlete/core:second']);
    expect(readPendingUpdate(root)).toBeUndefined();
    expect(readFileSync(join(root, UPDATE_DIR, TASKS_FILE), 'utf8')).toContain(
      '- `@ethlete/core` first (@ethlete/core:first)\n- `@ethlete/core` second (@ethlete/core:second)',
    );
  });

  it('migrates from the --from version of the run it continues', async () => {
    const root = makeRepo();
    const newer = { 'dist-tags': { latest: '5.2.0' }, versions: { '5.1.0': {}, '5.2.0': {} } };

    rmSync(join(root, UPDATE_DIR), { recursive: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(newer))),
    );
    spawnSync.mockImplementation((_binary, args) => ({ status: args.includes('@ethlete/core:second') ? 1 : 0 }));

    expect(await updateCommand({ argv: ['--from', 'core@5.0.0'], root })).toBe(1);

    spawnSync.mockReset();
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(generatorsRun()).toEqual(['@ethlete/core:second']);
  });

  it('adds the task list to .gitignore, so the next run finds a clean tree', async () => {
    const root = makeRepo();

    spawnSync.mockImplementation((_binary, args) => ({ status: args.includes('check-ignore') ? 1 : 0 }));

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('.ethlete/update/\n');
  });

  it('leaves the pending file alone on a dry run', async () => {
    const root = makeRepo();

    spawnSync.mockReturnValue({ status: 0 });

    await updateCommand({ argv: ['--continue', '--dry-run'], root });

    expect(readPendingUpdate(root)?.finished).toEqual([]);
  });
});

describe('et update --check', () => {
  it('reports an update that was started but never finished', async () => {
    const root = makeRepo();
    const upToDate = { 'dist-tags': { latest: '5.1.0' }, versions: { '5.1.0': {} } };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(upToDate))),
    );

    expect(await updateCommand({ argv: ['--check'], root })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--continue'));
  });

  it('points a plain run to --continue while an update is unfinished', async () => {
    const root = makeRepo();
    const upToDate = { 'dist-tags': { latest: '5.1.0' }, versions: { '5.1.0': {} } };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(upToDate))),
    );

    expect(await updateCommand({ argv: [], root })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--continue'));
    expect(generatorsRun()).toEqual([]);
  });

  it('does not call the packages up to date when every lookup failed', async () => {
    const root = makeRepo();

    rmSync(join(root, UPDATE_DIR), { recursive: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );

    expect(await updateCommand({ argv: ['--check'], root })).toBe(1);
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('newest version'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('lookup(s) failed'));
  });
});

const withAgentRules = (root: string) => {
  writeJson(join(root, 'node_modules', '@ethlete', 'agent-rules', 'package.json'), { name: '@ethlete/agent-rules' });
  writeJson(join(root, 'ethlete-agents.config.json'), {});
  writePendingUpdate({
    root,
    pending: {
      startedAt: 'then',
      packages: [
        { name: '@ethlete/core', from: '5.0.0', to: '5.1.0' },
        { name: '@ethlete/agent-rules', from: '0.1.0', to: '0.2.0' },
      ],
    },
  });

  return root;
};

describe('the agent rules sync', () => {
  it('runs before the codemods, so the tasks follow the new guidance', async () => {
    const root = withAgentRules(makeRepo());

    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(
      spawnSync.mock.calls.flatMap(([, args]) => args.filter((arg) => /ethlete-agents|@ethlete\/core:/.test(arg))),
    ).toEqual(['ethlete-agents', '@ethlete/core:first', '@ethlete/core:second']);
  });
});

describe('a failed agent rules sync', () => {
  it('is counted as a failure and written to tasks.md', async () => {
    const root = withAgentRules(makeRepo());

    spawnSync.mockImplementation((_binary, args) => ({ status: args.includes('ethlete-agents') ? 1 : 0 }));

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 codemod(s) applied, 0 task(s) left, 1 failed'));
    expect(readFileSync(join(root, UPDATE_DIR, TASKS_FILE), 'utf8')).toContain(
      'The agent rules sync failed — yarn exited with 1. Run `yarn ethlete-agents sync` again by hand',
    );
  });
});

const withAgent = (root: string) => {
  writeJson(join(root, 'ethlete.config.local.json'), { updateAgentCommand: 'agent -p' });

  return root;
};

const assistedTask = (name: string) => ({
  packageName: '@ethlete/core',
  name,
  version: '5.1.0',
  kind: 'assisted',
  description: `Change ${name}`,
  instructionsFile: join(UPDATE_DIR, `core-${name}.md`),
});

const withOpenTasks = (root: string) => {
  writeJson(join(root, UPDATE_DIR, TASKS_DATA_FILE), {
    generatedAt: 'then',
    updates: [{ package: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
    applied: [],
    failed: [],
    tasks: [assistedTask('open'), assistedTask('done')],
  });
  writeFileSync(join(root, UPDATE_DIR, 'core-open.md'), 'Change it.', 'utf8');
  writeFileSync(join(root, UPDATE_DIR, TASKS_FILE), '### @ethlete/core — done\n', 'utf8');

  return root;
};

const agentCommands = () =>
  spawnSync.mock.calls.map(([command]) => command).filter((command) => command.startsWith('agent -p'));

const agentTaskFiles = () =>
  spawnSync.mock.calls
    .filter(([command]) => command.startsWith('agent -p'))
    .map(([, options]) => (options as unknown as { env?: NodeJS.ProcessEnv }).env?.['ETHLETE_UPDATE_TASK_FILE']);

describe('et update --ai', () => {
  it('fails before it changes anything when no agent command is configured', async () => {
    const root = makeRepo();

    rmSync(join(root, UPDATE_DIR), { recursive: true });
    stubRegistry('5.2.0');
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--ai'], root })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--ai needs "updateAgentCommand"'));
    expect(spawnSync).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies['@ethlete/core']).toBe('5.1.0');
  });

  it('hands the open tasks of an earlier run to the agent when every package is up to date', async () => {
    const root = withOpenTasks(withAgent(makeRepo()));

    rmSync(join(root, PENDING_FILE));
    stubRegistry('5.1.0');
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--ai'], root })).toBe(0);
    expect(agentTaskFiles()).toEqual([join(root, UPDATE_DIR, 'core-open.md')]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('the agent left'));
  });

  it('hands the open tasks to the agent from --continue when no update is unfinished', async () => {
    const root = withOpenTasks(withAgent(makeRepo()));

    rmSync(join(root, PENDING_FILE));
    spawnSync.mockImplementation((command: string) => {
      if (command.startsWith('agent -p')) rmSync(join(root, UPDATE_DIR, 'core-open.md'));

      return { status: 0 };
    });

    expect(await updateCommand({ argv: ['--continue', '--ai'], root })).toBe(0);
    expect(agentCommands()).toHaveLength(1);
  });

  it('exits 1 when an agent run fails', async () => {
    const root = withOpenTasks(withAgent(makeRepo()));

    rmSync(join(root, PENDING_FILE));
    spawnSync.mockReturnValue({ status: 3 });

    expect(await updateCommand({ argv: ['--continue', '--ai'], root })).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('et update --ai` again'));
  });
});

describe('the task list', () => {
  it('drops a deleted task from tasks.md on a run that has nothing to update', async () => {
    const root = withOpenTasks(makeRepo());

    rmSync(join(root, PENDING_FILE));
    stubRegistry('5.1.0');

    expect(await updateCommand({ argv: [], root })).toBe(0);

    const report = readFileSync(join(root, UPDATE_DIR, TASKS_FILE), 'utf8');

    expect(report).toContain('### @ethlete/core — open');
    expect(report).not.toContain('— done');
    expect(JSON.parse(readFileSync(join(root, UPDATE_DIR, TASKS_DATA_FILE), 'utf8')).tasks).toHaveLength(1);
  });

  it('drops a deleted task from tasks.md on a --continue with no migration left', async () => {
    const root = withOpenTasks(makeRepo());

    writePendingUpdate({
      root,
      pending: {
        startedAt: 'then',
        packages: [{ name: '@ethlete/core', from: '5.0.0', to: '5.1.0' }],
        finished: [
          { packageName: '@ethlete/core', name: 'first' },
          { packageName: '@ethlete/core', name: 'second' },
        ],
      },
    });
    rmSync(join(root, 'node_modules', '@ethlete', 'core', 'migrations.json'));
    writeJson(join(root, 'node_modules', '@ethlete', 'core', 'migrations.json'), { migrations: [] });
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(readFileSync(join(root, UPDATE_DIR, TASKS_FILE), 'utf8')).not.toContain('— done');
  });
});

describe('the printed plan', () => {
  it('says so when the installed versions know no migration', async () => {
    const root = makeRepo();

    rmSync(join(root, PENDING_FILE));

    stubRegistry('5.2.0');

    expect(await updateCommand({ argv: ['--dry-run'], root })).toBe(0);
    expect(console.log).toHaveBeenCalledWith('  none');
  });

  it('aligns the packages of a --continue', async () => {
    const root = withAgentRules(makeRepo());

    spawnSync.mockReturnValue({ status: 0 });

    await updateCommand({ argv: ['--continue', '--dry-run'], root });

    expect(console.log).toHaveBeenCalledWith('  @ethlete/core         5.0.0 → 5.1.0');
    expect(console.log).toHaveBeenCalledWith('  @ethlete/agent-rules  0.1.0 → 0.2.0');
  });
});

const gitIn = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const makeGitRepo = () => {
  const root = makeRepo();

  rmSync(join(root, UPDATE_DIR), { recursive: true });
  writeJson(join(root, 'node_modules', '@ethlete', 'core', 'migrations.json'), {
    migrations: ['first', 'second'].map((name) => ({
      name,
      version: '5.2.0',
      kind: 'auto',
      description: `Rewrite ${name}`,
      generator: `@ethlete/core:${name}`,
    })),
  });
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.ethlete/update/\n', 'utf8');
  writeJson(join(root, 'src', 'mine.ts'), 'mine');
  gitIn(root, 'init', '--quiet');
  gitIn(root, 'config', 'user.email', 'test@example.com');
  gitIn(root, 'config', 'user.name', 'Test');
  gitIn(root, 'config', 'commit.gpgsign', 'false');
  gitIn(root, 'config', 'core.hooksPath', mkdtempSync(join(tmpdir(), 'cli-update-hooks-')));
  gitIn(root, 'add', '--all');
  gitIn(root, 'commit', '--quiet', '-m', 'initial');
  gitIn(root, 'tag', 'initial');
  writeFileSync(join(root, 'src', 'mine.ts'), 'my own work', 'utf8');

  return root;
};

const runTools = (root: string, writes: Record<string, string>) =>
  spawnSync.mockImplementation((binary, args) => {
    if (binary === 'yarn' && args[0] === 'install') writeFileSync(join(root, 'yarn.lock'), 'lock', 'utf8');

    for (const [generator, path] of Object.entries(writes)) {
      if (args.includes(generator)) writeFileSync(join(root, path), generator, 'utf8');
    }

    return { status: 0 };
  });

const subjects = (root: string) => gitIn(root, 'log', '--format=%s').trim().split('\n');

const committedFiles = (root: string) =>
  gitIn(root, 'log', '--name-only', '--format=', 'initial..HEAD').trim().split('\n').filter(Boolean);

describe('the commits of et update', () => {
  it("commits the bump and each codemod by itself, and leaves the user's changes alone", async () => {
    const root = makeGitRepo();

    stubRegistry('5.2.0');
    runTools(root, { '@ethlete/core:first': 'src/first.ts', '@ethlete/core:second': 'src/second.ts' });

    expect(await updateCommand({ argv: ['--force'], root })).toBe(0);
    expect(subjects(root)).toEqual([
      'chore(deps): Apply the @ethlete/core second migration',
      'chore(deps): Apply the @ethlete/core first migration',
      'chore(deps): Update the ethlete SDK',
      'initial',
    ]);
    expect(gitIn(root, 'log', '-1', '--format=%b', 'HEAD~2').trim()).toBe('@ethlete/core 5.1.0 → 5.2.0');
    expect(gitIn(root, 'show', '--name-only', '--format=', 'HEAD~2').trim()).toBe('package.json\nyarn.lock');
    expect(gitIn(root, 'show', '--name-only', '--format=', 'HEAD~1').trim()).toBe('src/first.ts');
    expect(gitIn(root, 'status', '--porcelain')).toBe(' M src/mine.ts\n');
  });

  it('does not commit a codemod that rewrote a file the user had changed', async () => {
    const root = makeGitRepo();

    stubRegistry('5.2.0');
    runTools(root, { '@ethlete/core:first': 'src/mine.ts', '@ethlete/core:second': 'src/second.ts' });

    expect(await updateCommand({ argv: ['--force'], root })).toBe(0);
    expect(committedFiles(root)).not.toContain('src/mine.ts');
    expect(subjects(root)).not.toContain('chore(deps): Apply the @ethlete/core first migration');
    expect(subjects(root)[0]).toBe('chore(deps): Apply the @ethlete/core second migration');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Not committed: src/mine.ts'));
  });

  it('keeps the snapshot of the run for a --continue after --no-install', async () => {
    const root = makeGitRepo();

    stubRegistry('5.2.0');
    runTools(root, { '@ethlete/core:first': 'src/mine.ts' });

    expect(await updateCommand({ argv: ['--force', '--no-install'], root })).toBe(0);
    expect(subjects(root)).toEqual(['initial']);

    writeFileSync(join(root, 'yarn.lock'), 'lock', 'utf8');

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(subjects(root)).toEqual(['chore(deps): Update the ethlete SDK', 'initial']);
    expect(committedFiles(root)).not.toContain('src/mine.ts');
  });

  it('commits an agent task that ends done, and not one that stays open', async () => {
    const root = withAgent(makeGitRepo());

    rmSync(join(root, PENDING_FILE), { force: true });
    withOpenTasks(root);
    writeFileSync(join(root, UPDATE_DIR, 'core-done.md'), 'Change it.', 'utf8');
    spawnSync.mockImplementation((command: string, options) => {
      const taskFile = (options as { env?: NodeJS.ProcessEnv } | undefined)?.env?.['ETHLETE_UPDATE_TASK_FILE'] ?? '';

      if (!command.startsWith('agent -p')) return { status: 0 };

      if (taskFile.endsWith('core-done.md')) {
        rmSync(taskFile);
        writeFileSync(join(root, 'src', 'done.ts'), 'done', 'utf8');
      } else writeFileSync(join(root, 'src', 'open.ts'), 'open', 'utf8');

      return { status: 0 };
    });

    expect(await updateCommand({ argv: ['--continue', '--ai'], root })).toBe(0);
    expect(subjects(root)).toEqual(['chore(deps): Apply the @ethlete/core done migration', 'initial']);
    expect(committedFiles(root)).toEqual(['src/done.ts']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('so it is not committed'));
  });

  it('commits nothing with --no-commit', async () => {
    const root = makeGitRepo();

    stubRegistry('5.2.0');
    runTools(root, { '@ethlete/core:first': 'src/first.ts' });

    expect(await updateCommand({ argv: ['--force', '--no-commit'], root })).toBe(0);
    expect(subjects(root)).toEqual(['initial']);
  });

  it('passes --no-commit to the installed CLI', async () => {
    const root = makeGitRepo();

    writeJson(join(root, 'package.json'), {
      name: 'app',
      packageManager: 'yarn@1.22.21',
      devDependencies: { '@ethlete/cli': '2.0.0' },
    });
    writeJson(join(root, 'node_modules', '@ethlete', 'cli', 'package.json'), {
      name: '@ethlete/cli',
      version: '2.0.0',
    });
    stubRegistry('2.1.0');
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--force', '--no-commit'], root })).toBe(0);
    expect(spawnSync).toHaveBeenCalledWith('yarn', ['et', 'update', '--continue', '--no-commit'], expect.anything());
  });
});

describe('et update on a stable line with a newer major on next', () => {
  it('points at the next tag even when the repo is up to date', async () => {
    const root = makeRepo();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    rmSync(join(root, UPDATE_DIR), { recursive: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              'dist-tags': { latest: '5.1.0', next: '6.0.0-next.3' },
              versions: { '5.1.0': {}, '6.0.0-next.3': {} },
            }),
          ),
      ),
    );

    expect(await updateCommand({ argv: ['--check'], root })).toBe(0);

    const output = log.mock.calls.map(([line]) => String(line)).join('\n');

    expect(output).toContain('a newer major is on "next": 6.0.0-next.3 - run et update --tag next');
  });
});
