import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingUpdate, writePendingUpdate } from './pending';
import { TASKS_FILE, UPDATE_DIR } from './tasks';
import { updateCommand } from './update-command';

const spawnSync = vi.hoisted(() => vi.fn<(binary: string, args: string[]) => { status: number }>());

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawnSync,
}));

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
