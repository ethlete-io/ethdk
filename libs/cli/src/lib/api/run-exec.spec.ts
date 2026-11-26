import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { ApiDefinition } from './definition';
import { runApiCommand } from './run';

type ComposeCallRecord = { args: string[]; stdio?: unknown };

const composeCalls: ComposeCallRecord[] = [];
let exitStatus = 0;

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    spawnSync: (command: string, args: string[], options: { stdio?: unknown }) => {
      if (command !== 'fake-compose') return actual.spawnSync(command, args, options as never);

      composeCalls.push({ args, stdio: options?.stdio });

      return { status: exitStatus, stdout: '', stderr: '' };
    },
  };
});

vi.mock('./compose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./compose')>()),
  resolveComposeTool: () => ({ engine: 'fake-engine', compose: ['fake-compose', 'compose'] }),
}));

const HUB: ApiDefinition = { composeDir: 'development', services: ['app', 'database'], execService: 'app', port: 8040 };

process.stdin.isTTY = false;

const errors: string[] = [];
const logs: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

afterEach(() => {
  composeCalls.length = 0;
  errors.length = 0;
  logs.length = 0;
  exitStatus = 0;
});

const makeRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-exec-'));

  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });

  return root;
};

const run = (argv: string[]) => runApiCommand({ apis: { hub: HUB }, argv, root: makeRoot() });

describe('et api exec', () => {
  it('runs the command without a TTY and hands every argument over unchanged', async () => {
    expect(await run(['exec', 'hub', 'database', '--', 'psql', '--help', '-c', 'select 1'])).toBe(0);

    expect(composeCalls).toHaveLength(1);
    expect(composeCalls[0]?.args).toEqual(['compose', 'exec', '-T', 'database', 'psql', '--help', '-c', 'select 1']);
    expect(composeCalls[0]?.stdio).toBe('inherit');
  });

  it('writes nothing to stdout itself', async () => {
    await run(['exec', 'hub', 'app', '--', 'true']);

    expect(logs).toEqual([]);
  });

  it('returns the exit code of the command unchanged', async () => {
    exitStatus = 42;

    expect(await run(['exec', 'hub', 'app', '--', 'false'])).toBe(42);
    expect(errors).toEqual([]);
  });

  it('is a usage error without --', async () => {
    expect(await run(['exec', 'hub', 'app', 'ls'])).toBe(1);
    expect(errors[0]).toContain('exec needs a command after "--"');
    expect(composeCalls).toEqual([]);
  });

  it('is a usage error with an empty command', async () => {
    expect(await run(['exec', 'hub', 'app', '--'])).toBe(1);
    expect(errors[0]).toContain('exec needs a command after "--"');
    expect(composeCalls).toEqual([]);
  });

  it('needs a service from the API', async () => {
    expect(await run(['exec', 'hub', '--', 'ls'])).toBe(1);
    expect(errors[0]).toContain('Name the service');

    errors.length = 0;

    expect(await run(['exec', 'hub', 'cache', '--', 'ls'])).toBe(1);
    expect(errors[0]).toContain('does not start "cache"');
    expect(composeCalls).toEqual([]);
  });

  it('does not read -h after -- as a request for help', async () => {
    expect(await run(['exec', 'hub', 'app', '--', 'ls', '-h'])).toBe(0);
    expect(logs).toEqual([]);
  });
});
