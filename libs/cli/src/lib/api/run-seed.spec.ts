import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { ApiDefinition } from './definition';
import { runApiCommand } from './run';

type ComposeCallRecord = { args: string[]; input?: Buffer };

const composeCalls: ComposeCallRecord[] = [];
let failingCall: number | undefined;

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    spawnSync: (command: string, args: string[], options: { input?: Buffer }) => {
      if (command !== 'fake-compose') return actual.spawnSync(command, args, options as never);

      composeCalls.push({ args, input: options?.input });

      return { status: composeCalls.length === failingCall ? 7 : 0, stdout: '', stderr: '' };
    },
  };
});

vi.mock('./compose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./compose')>()),
  resolveComposeTool: () => ({ engine: 'fake-engine', compose: ['fake-compose', 'compose'] }),
}));

const HUB: ApiDefinition = { composeDir: 'development', services: ['app'], execService: 'app', port: 8040 };

const MANIFEST = {
  fixtures: ['bin/console fixtures'],
  seeds: { rewards: { description: 'Rewards', run: ['php $SEED_DIR/r.php'] }, wc26: { run: ['php $SEED_DIR/w.php'] } },
};

process.stdin.isTTY = false;

const errors: string[] = [];
const warnings: string[] = [];
const logs: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => void warnings.push(String(message)));
vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

afterEach(() => {
  composeCalls.length = 0;
  errors.length = 0;
  warnings.length = 0;
  logs.length = 0;
  failingCall = undefined;
});

const makeRoot = (manifest: unknown = MANIFEST) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-seed-'));

  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });
  mkdirSync(join(root, '.ethlete/seeds/hub'), { recursive: true });
  writeFileSync(join(root, '.ethlete/seeds/hub/seeds.json'), JSON.stringify(manifest), 'utf8');
  writeFileSync(join(root, '.ethlete/seeds/hub/r.php'), '<?php echo 1;', 'utf8');

  return root;
};

const run = (argv: string[], root: string, api: Partial<ApiDefinition> = {}) =>
  runApiCommand({ apis: { hub: { ...HUB, ...api } }, argv, root });

const scriptOf = (call: ComposeCallRecord | undefined) => call?.args[call.args.length - 1] ?? '';

describe('et api seed', () => {
  it('lists the seeds without starting a container', async () => {
    expect(await run(['seed', 'hub'], makeRoot())).toBe(0);
    expect(logs.join('\n')).toContain('  rewards  Rewards');
    expect(composeCalls).toEqual([]);
  });

  it('copies the seed folder in, then runs each seed in the order named', async () => {
    expect(await run(['seed', 'hub', 'wc26,rewards'], makeRoot())).toBe(0);

    const [copy, first, second] = composeCalls;

    expect(copy?.args.slice(0, 4)).toEqual(['compose', 'exec', '-T', 'app']);
    expect(scriptOf(copy)).toContain(`tar -x -C '/tmp/ethlete-seeds/hub'`);
    expect(copy?.input?.toString('latin1')).toContain('r.php');
    expect(first?.args.slice(0, 4)).toEqual(['compose', 'exec', '-T', 'app']);
    expect(scriptOf(first)).toBe(`set -e\nexport SEED_DIR='/tmp/ethlete-seeds/hub'\nphp $SEED_DIR/w.php`);
    expect(scriptOf(second)).toContain('php $SEED_DIR/r.php');
    expect(composeCalls).toHaveLength(3);
  });

  it('fails on an unknown seed before it runs anything', async () => {
    expect(await run(['seed', 'hub', 'rewards,rewads'], makeRoot())).toBe(1);
    expect(errors[0]).toContain('The hub API has no seed "rewads". Did you mean "rewards"?');
    expect(composeCalls).toEqual([]);
  });

  it('reports an invalid manifest before it runs anything', async () => {
    expect(await run(['seed', 'hub', 'rewards'], makeRoot({ seeds: { rewards: {} } }))).toBe(1);
    expect(errors[0]).toContain('.ethlete/seeds/hub/seeds.json: seeds.rewards.run must be');
    expect(composeCalls).toEqual([]);
  });

  it('stops at the first seed that fails', async () => {
    failingCall = 2;

    expect(await run(['seed', 'hub', 'rewards,wc26'], makeRoot())).toBe(7);
    expect(errors.join('\n')).toContain('rewards failed with exit code 7.');
    expect(composeCalls).toHaveLength(2);
  });

  it('runs an exec entry named seed instead of the manifest', async () => {
    const root = makeRoot({ seeds: 'not even valid' });

    expect(await run(['seed', 'hub'], root, { exec: { seed: ['make', 'seed'] } })).toBe(0);
    expect(composeCalls.map(({ args }) => args)).toEqual([['compose', 'exec', 'app', 'make', 'seed']]);
  });
});

describe('et api fixtures', () => {
  it('runs the fixtures, then the seeds it names', async () => {
    expect(await run(['fixtures', 'hub', 'rewards'], makeRoot())).toBe(0);

    expect(composeCalls).toHaveLength(3);
    expect(scriptOf(composeCalls[1])).toContain('bin/console fixtures');
    expect(scriptOf(composeCalls[2])).toContain('php $SEED_DIR/r.php');
  });

  it('runs only the fixtures when no seed is named', async () => {
    expect(await run(['fixtures', 'hub'], makeRoot())).toBe(0);
    expect(composeCalls).toHaveLength(2);
  });

  it('runs an exec entry named fixtures instead of the manifest', async () => {
    expect(await run(['fixtures', 'hub'], makeRoot(), { exec: { fixtures: ['make', 'fixtures'] } })).toBe(0);
    expect(composeCalls.map(({ args }) => args)).toEqual([['compose', 'exec', 'app', 'make', 'fixtures']]);
  });
});

describe('gitignore', () => {
  const gitRoot = (ignore: string) => {
    const root = makeRoot();

    spawnSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), ignore, 'utf8');

    return root;
  };

  it('warns when the seed folder is ignored with the rest of .ethlete', async () => {
    await run(['seed', 'hub'], gitRoot('.ethlete\n'));

    expect(warnings[0]).toContain('.ethlete/seeds/hub/seeds.json is gitignored');
    expect(warnings[0]).toContain('"/.ethlete/hub/"');
  });

  it('stays quiet when only the managed checkouts are ignored', async () => {
    await run(['seed', 'hub'], gitRoot('/.ethlete/hub/\n'));

    expect(warnings).toEqual([]);
  });

  it('ignores the managed checkout it clones into, and nothing beside it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-api-clone-'));

    spawnSync('git', ['init', '-q'], { cwd: root });

    await runApiCommand({
      apis: { hub: { ...HUB, repoUrl: join(root, 'missing.git') } },
      argv: ['clone', 'hub'],
      root,
    });

    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('/.ethlete/hub/\n');
    expect(logs.join('\n')).toContain('Added /.ethlete/hub/ to .gitignore.');
    expect(existsSync(join(root, '.ethlete/hub'))).toBe(false);
  });
});
