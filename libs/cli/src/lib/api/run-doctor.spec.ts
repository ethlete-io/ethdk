import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { ApiDefinition } from './definition';
import { runApiCommand } from './run';

type Call = { command: string; args: string[]; cwd?: string; env?: Record<string, string>; stdio?: unknown };
type Reply = { status: number; stderr?: string };

const calls: Call[] = [];
let respond: (call: Call) => Reply = () => ({ status: 0 });

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    spawnSync: (command: string, args: string[], options: Omit<Call, 'command' | 'args'>) => {
      if (command !== 'fake-compose' && command !== 'sh') return actual.spawnSync(command, args, options as never);

      const call = { command, args, cwd: options.cwd, env: options.env, stdio: options.stdio };

      calls.push(call);

      return { stdout: '', stderr: '', ...respond(call) };
    },
  };
});

vi.mock('./compose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./compose')>()),
  resolveComposeTool: () => ({ engine: 'fake-engine', compose: ['fake-compose', 'compose'] }),
}));

const api = (checks?: ApiDefinition['checks']): ApiDefinition => ({
  composeDir: 'development',
  services: ['app', 'database'],
  execService: 'app',
  port: 8040,
  env: () => ({ HUB_MARK: 'yes' }),
  checks,
});

process.stdin.isTTY = false;

const errors: string[] = [];
const logs: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

afterEach(() => {
  calls.length = 0;
  errors.length = 0;
  logs.length = 0;
  respond = () => ({ status: 0 });
});

const run = (definition: ApiDefinition, argv: string[]) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-doctor-'));

  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });

  return runApiCommand({ apis: { hub: definition }, argv: ['doctor', 'hub', ...argv], root });
};

const lineOf = (call: Pick<Call, 'args'> | undefined) => call?.args[call.args.length - 1];

describe('et api doctor', () => {
  it('says so when the API declares no checks', async () => {
    expect(await run(api(), [])).toBe(0);
    expect(logs[0]).toContain('declares no checks');
    expect(calls).toEqual([]);
  });

  it('runs container checks with exec -T in their service, in order, and reports ok', async () => {
    const code = await run(
      api([
        { name: 'one', check: 'test -f a' },
        { name: 'two', check: 'test -f b', service: 'database' },
      ]),
      [],
    );

    expect(code).toBe(0);
    expect(calls.map(({ args }) => args.slice(0, 5))).toEqual([
      ['compose', 'exec', '-T', 'app', 'sh'],
      ['compose', 'exec', '-T', 'database', 'sh'],
    ]);
    expect(logs).toEqual([expect.stringMatching(/^ok\s+one$/), expect.stringMatching(/^ok\s+two$/)]);
  });

  it('runs a host check with sh in the compose dir and the API env', async () => {
    expect(await run(api([{ name: 'host', check: 'echo hi', host: true }]), [])).toBe(0);

    expect(calls[0]?.command).toBe('sh');
    expect(calls[0]?.args).toEqual(['-c', 'echo hi']);
    expect(calls[0]?.cwd).toMatch(/api\/development$/);
    expect(calls[0]?.env?.['HUB_MARK']).toBe('yes');
  });

  it('runs every check without --fix, prints the stderr tail of failures and exits 1', async () => {
    respond = ({ args }) =>
      lineOf({ args }) === 'bad'
        ? { status: 1, stderr: ['1', '2', '3', '4', '5', '6', '7'].join('\n') }
        : { status: 0 };

    const code = await run(
      api([
        { name: 'first', check: 'bad', fix: 'repair' },
        { name: 'second', check: 'good' },
      ]),
      [],
    );

    expect(code).toBe(1);
    expect(calls).toHaveLength(2);
    expect(logs[0]).toMatch(/^FAIL\s+first$/);
    expect(logs.slice(1, 6)).toEqual(['    3', '    4', '    5', '    6', '    7']);
    expect(logs[logs.length - 1]).toMatch(/^ok\s+second$/);
  });

  it('with --fix runs the fix streaming its output, checks again and reports fixed', async () => {
    let fixed = false;

    respond = ({ args }) => {
      if (lineOf({ args }) === 'repair') {
        fixed = true;

        return { status: 0 };
      }

      return { status: fixed ? 0 : 1 };
    };

    expect(await run(api([{ name: 'first', check: 'probe', fix: 'repair' }]), ['--fix'])).toBe(0);

    expect(calls.map((call) => lineOf(call))).toEqual(['probe', 'repair', 'probe']);
    expect(calls[1]?.stdio).toBe('inherit');
    expect(logs[logs.length - 1]).toMatch(/^fixed\s+first$/);
  });

  it('with --fix stops at a fix that fails', async () => {
    respond = ({ args }) => ({ status: lineOf({ args }) === 'good' ? 0 : 1 });

    const code = await run(
      api([
        { name: 'first', check: 'probe', fix: 'repair' },
        { name: 'second', check: 'good' },
      ]),
      ['--fix'],
    );

    expect(code).toBe(1);
    expect(calls.map((call) => lineOf(call))).toEqual(['probe', 'repair']);
    expect(logs[logs.length - 1]).toMatch(/^fix failed\s+first$/);
  });

  it('with --fix stops when the check still fails after its fix', async () => {
    respond = ({ args }) => ({ status: lineOf({ args }) === 'repair' ? 0 : 1 });

    expect(
      await run(
        api([
          { name: 'first', check: 'probe', fix: 'repair' },
          { name: 'next', check: 'x' },
        ]),
        ['--fix'],
      ),
    ).toBe(1);

    expect(calls.map((call) => lineOf(call))).toEqual(['probe', 'repair', 'probe']);
    expect(logs[logs.length - 1]).toContain('still failing');
  });

  it('with --fix stops at a failed check that has no fix', async () => {
    respond = () => ({ status: 1 });

    expect(
      await run(
        api([
          { name: 'first', check: 'probe' },
          { name: 'next', check: 'x' },
        ]),
        ['--fix'],
      ),
    ).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('points at up when the service is not running', async () => {
    respond = () => ({ status: 1, stderr: 'service "app" is not running' });

    expect(await run(api([{ name: 'first', check: 'probe', fix: 'repair' }]), ['--fix'])).toBe(1);

    expect(calls).toHaveLength(1);
    expect(errors[0]).toContain('et api up hub');
  });

  it('points at up for the text podman prints for a stopped container', async () => {
    respond = () => ({
      status: 255,
      stderr: 'Error: can only create exec sessions on running containers: container state improper',
    });

    expect(await run(api([{ name: 'first', check: 'probe' }]), [])).toBe(1);

    expect(errors[0]).toContain('et api up hub');
  });
});
