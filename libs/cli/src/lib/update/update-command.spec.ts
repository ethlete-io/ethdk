import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingUpdate, writePendingUpdate } from './pending';
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
});

describe('et update --continue', () => {
  it('does not run a codemod again that applied in the earlier run', async () => {
    const root = makeRepo();

    spawnSync.mockImplementation((_binary, args) => ({
      status: args.includes('@ethlete/core:second') ? 1 : 0,
    }));

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(1);
    expect(readPendingUpdate(root)?.finished).toEqual([{ packageName: '@ethlete/core', name: 'first' }]);

    spawnSync.mockReset();
    spawnSync.mockReturnValue({ status: 0 });

    expect(await updateCommand({ argv: ['--continue'], root })).toBe(0);
    expect(generatorsRun()).toEqual(['@ethlete/core:second']);
    expect(readPendingUpdate(root)).toBeUndefined();
  });

  it('leaves the pending file alone on a dry run', async () => {
    const root = makeRepo();

    spawnSync.mockReturnValue({ status: 0 });

    await updateCommand({ argv: ['--continue', '--dry-run'], root });

    expect(readPendingUpdate(root)?.finished).toEqual([]);
  });
});
