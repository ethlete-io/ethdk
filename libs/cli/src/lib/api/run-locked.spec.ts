import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { hostname, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { apiStateDirectory, readApiState, writeApiState } from './api-state';
import { ApiDefinition } from './definition';
import { ApiLock, lockPath, readApiLock } from './lock';
import { runApiCommand } from './run';

const HUB: ApiDefinition = { composeDir: 'development', services: ['app'], execService: 'app', port: 8040 };

const errors: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));

afterEach(() => {
  errors.length = 0;
});

const makeRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-run-'));

  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });

  return root;
};

const stateDirectory = () => apiStateDirectory({ project: 'development' });

const run = (argv: string[], root = makeRoot()) => runApiCommand({ apis: { hub: HUB, other: HUB }, argv, root });

const sh = (script: string) => ['--', 'sh', '-c', script];

const plantLock = (lock: Partial<ApiLock>) => {
  mkdirSync(stateDirectory(), { recursive: true });
  writeFileSync(
    lockPath(stateDirectory()),
    JSON.stringify({
      pid: process.pid,
      hostname: hostname(),
      command: 'playwright test',
      cwd: '/elsewhere',
      startedAt: '2026-10-19T09:00:00.000Z',
      token: 'held',
      ...lock,
    }),
    'utf8',
  );
};

const waitFor = async (path: string) => {
  while (!existsSync(path)) await new Promise((resolve) => setTimeout(resolve, 10));
};

describe('et api run --lock', () => {
  it('runs the command in the repo root under the lock, then releases it and marks the state dirty', async () => {
    const root = makeRoot();

    writeApiState({
      directory: stateDirectory(),
      state: { profile: 'e2e', fingerprint: 'abc123def456', dirty: false },
    });

    const code = await run(
      ['run', 'hub', '--lock', ...sh('pwd > seen-cwd; echo "$ETHLETE_API_LOCK" > seen-token')],
      root,
    );

    expect(code).toBe(0);
    expect(readFileSync(join(root, 'seen-cwd'), 'utf8').trim()).toBe(root);
    expect(readFileSync(join(root, 'seen-token'), 'utf8').trim()).not.toBe('');
    expect(readApiLock(stateDirectory())).toBeUndefined();
    expect(readApiState(stateDirectory())).toMatchObject({ profile: 'e2e', dirty: true });
  });

  it('hands the lock token to the command', async () => {
    const root = makeRoot();
    const script = `echo "$ETHLETE_API_LOCK" > seen-token; cp '${lockPath(stateDirectory())}' seen-lock`;

    expect(await run(['run', 'hub', '--lock', ...sh(script)], root)).toBe(0);

    const lock = JSON.parse(readFileSync(join(root, 'seen-lock'), 'utf8')) as ApiLock;

    expect(lock).toMatchObject({ pid: process.pid, hostname: hostname(), cwd: root, command: `sh -c ${script}` });
    expect(readFileSync(join(root, 'seen-token'), 'utf8').trim()).toBe(lock.token);
  });

  it('returns the exit code of the command', async () => {
    expect(await run(['run', 'hub', '--lock', ...sh('exit 3')])).toBe(3);
    expect(readApiLock(stateDirectory())).toBeUndefined();
  });

  it('returns 128 plus the signal number when a signal ends the command', async () => {
    expect(await run(['run', 'hub', '--lock', ...sh('kill -TERM $$')])).toBe(143);
  });

  it('forwards SIGINT to the command', async () => {
    const root = makeRoot();
    const running = run(
      ['run', 'hub', '--lock', ...sh('trap "exit 9" INT; touch ready; while :; do sleep 0.05; done')],
      root,
    );

    await waitFor(join(root, 'ready'));
    process.emit('SIGINT', 'SIGINT');

    expect(await running).toBe(9);
    expect(process.listenerCount('SIGINT')).toBe(0);
    expect(readApiLock(stateDirectory())).toBeUndefined();
  });

  it('releases the lock when the command cannot start', async () => {
    expect(await run(['run', 'hub', '--lock', '--', 'no-such-command-anywhere'])).toBe(127);
    expect(readApiLock(stateDirectory())).toBeUndefined();
  });

  it('gives up with 75 and names the holder when the lock stays taken', async () => {
    const root = makeRoot();

    plantLock({ token: 'held' });

    expect(await run(['run', 'hub', '--lock', '--wait', '0', ...sh('touch ran')], root)).toBe(75);
    expect(existsSync(join(root, 'ran'))).toBe(false);
    expect(errors.join('\n')).toContain(`pid ${process.pid} on ${hostname()}`);
    expect(errors.join('\n')).toContain('playwright test (in /elsewhere)');
    expect(readApiLock(stateDirectory())?.token).toBe('held');
  });

  it('takes over the lock of a process that died', async () => {
    const dead = spawnSync('true').pid;

    plantLock({ pid: dead, token: 'stale' });

    expect(await run(['run', 'hub', '--lock', '--wait', '0', ...sh('exit 0')])).toBe(0);
    expect(readApiLock(stateDirectory())).toBeUndefined();
    expect(readApiState(stateDirectory())?.dirty).toBe(true);
  });

  it.each([
    [['run', 'hub', ...sh('true')], 'run needs --lock'],
    [['run', 'hub', '--lock', 'true'], 'run needs --lock and a command after "--"'],
    [['run', 'hub', '--lock', '--'], 'run needs --lock and a command after "--"'],
    [['run', 'hub,other', '--lock', ...sh('true')], 'run locks one API at a time'],
    [['run', 'hub', '--lock', '--wait', 'soon', ...sh('true')], '--wait takes a number of seconds'],
  ])('is a usage error for %j', async (argv, message) => {
    expect(await run(argv)).toBe(1);
    expect(errors[0]).toContain(message);
  });
});
