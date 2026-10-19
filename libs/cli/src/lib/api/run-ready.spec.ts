import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { apiStateDirectory, composeProjectName, readApiState, writeApiState } from './api-state';
import { ApiDefinition } from './definition';
import { API_LOCK_ENV, acquireApiLock, lockPath, readApiLock } from './lock';
import { ReadySeedUnit, runReadyCommand, waitForHealth } from './run-ready';

let fakeBinary = '';

vi.mock('./compose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./compose')>()),
  resolveComposeTool: () => ({ engine: 'fake-engine', compose: [fakeBinary] }),
}));

const errors: string[] = [];
const logs: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

const SNAPSHOT = {
  service: 'database',
  databases: ['app'],
  save: 'echo "dump of $DATABASES"',
  restore: 'cat > "$OUT"',
};

const API: ApiDefinition = {
  composeDir: 'development',
  services: ['app', 'database'],
  execService: 'app',
  port: 8040,
  exec: { warm: ['bin/console cache:warmup'] },
  profiles: {
    e2e: { seeds: ['fixtures', 'users', 'warm'], snapshot: SNAPSHOT },
    plain: { seeds: ['users'] },
    healthy: { seeds: ['users'], health: { url: 'http://localhost:8040/health', expect: 204 } },
    typo: { seeds: ['user'] },
  },
};

const MANIFEST = { fixtures: ['bin/console fixtures'], seeds: { users: { run: ['php users.php'] } } };

const setup = (definition: ApiDefinition = API) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-ready-'));
  const state = mkdtempSync(join(tmpdir(), 'cli-api-ready-state-'));

  vi.stubEnv('XDG_STATE_HOME', state);
  vi.stubEnv('OUT', join(root, 'restored.sql'));
  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });
  mkdirSync(join(root, '.ethlete/seeds/hub'), { recursive: true });
  writeFileSync(join(root, '.ethlete/seeds/hub/seeds.json'), JSON.stringify(MANIFEST), 'utf8');

  const directory = apiStateDirectory({
    project: composeProjectName({ composePath: join(root, 'api/development'), env: {} }),
  });
  const calls = { up: 0, seeds: [] as ReadySeedUnit[] };
  let clock = 0;
  const sleeps: number[] = [];

  const ready = (
    profile: string | undefined,
    overrides: Partial<Parameters<typeof runReadyCommand>[0]> = {},
  ): Promise<number> =>
    runReadyCommand({
      root,
      name: 'hub',
      api: definition,
      invocation: 'et api',
      profile,
      wait: 0,
      up: async () => {
        calls.up++;

        return 0;
      },
      runSeeds: async (unit) => {
        calls.seeds.push(unit);

        return 0;
      },
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      ...overrides,
    });

  return { root, directory, calls, sleeps, ready };
};

const snapshotsOf = (root: string) =>
  existsSync(join(root, '.ethlete/snapshots/hub')) ? readdirSync(join(root, '.ethlete/snapshots/hub')) : [];

beforeAll(() => {
  const directory = mkdtempSync(join(tmpdir(), 'cli-api-ready-bin-'));

  fakeBinary = join(directory, 'compose');
  writeFileSync(fakeBinary, `#!/bin/sh\nshift 4\nexec sh -c "$2"\n`);
  chmodSync(fakeBinary, 0o755);
});

afterEach(() => {
  errors.length = 0;
  logs.length = 0;
  vi.unstubAllEnvs();
});

describe('et api ready', () => {
  it('needs an existing profile', async () => {
    const { ready, calls } = setup();

    expect(await ready(undefined)).toBe(1);
    expect(errors.join('\n')).toContain('ready needs a profile');
    expect(await ready('e2f')).toBe(1);
    expect(errors.join('\n')).toContain('Did you mean "e2e"?');
    expect(calls.up).toBe(0);
  });

  it('rejects an unknown seed name before anything runs', async () => {
    const { ready, calls, directory } = setup();

    expect(await ready('typo')).toBe(1);
    expect(errors.join('\n')).toContain('names "user"');
    expect(errors.join('\n')).toContain('Did you mean "users"?');
    expect(calls.up).toBe(0);
    expect(existsSync(lockPath(directory))).toBe(false);
  });

  it('seeds in order, saves the snapshot and records the state as clean on a fresh API', async () => {
    const { ready, calls, directory, root } = setup();

    expect(await ready('e2e')).toBe(0);
    expect(calls.up).toBe(1);
    expect(calls.seeds).toEqual([
      {
        kind: 'steps',
        steps: [
          { label: 'fixtures', lines: ['bin/console fixtures'], env: {} },
          { label: 'users', lines: ['php users.php'], env: {} },
        ],
      },
      { kind: 'exec', name: 'warm' },
    ]);

    const state = readApiState(directory);

    expect(state).toMatchObject({ profile: 'e2e', dirty: false });
    expect(snapshotsOf(root)).toEqual([`e2e-${state?.fingerprint}.sql.gz`]);
    expect(logs.join('\n')).toMatch(new RegExp(`hub is ready: profile e2e, fingerprint ${state?.fingerprint}, in`));
    expect(existsSync(lockPath(directory))).toBe(false);
  });

  it('does nothing to the data when the state is clean for the same profile and fingerprint', async () => {
    const { ready, calls } = setup();

    await ready('e2e');
    calls.seeds.length = 0;

    expect(await ready('e2e')).toBe(0);
    expect(calls.seeds).toEqual([]);
    expect(errors.join('\n')).toContain('Already ready: e2e');
  });

  it('restores the snapshot of the fingerprint when the state is dirty', async () => {
    const { ready, calls, directory } = setup();

    await ready('e2e');

    const fingerprint = readApiState(directory)?.fingerprint ?? null;

    writeApiState({ directory, state: { profile: 'e2e', fingerprint, dirty: true } });
    calls.seeds.length = 0;

    expect(await ready('e2e')).toBe(0);
    expect(calls.seeds).toEqual([]);
    expect(errors.join('\n')).toContain('Restoring the e2e snapshot');
    expect(readApiState(directory)).toMatchObject({ profile: 'e2e', fingerprint, dirty: false });
  });

  it('seeds again when the stored state belongs to another profile and there is no snapshot', async () => {
    const { ready, calls, directory, root } = setup();

    await ready('e2e');
    calls.seeds.length = 0;

    expect(await ready('plain')).toBe(0);
    expect(calls.seeds).toHaveLength(1);
    expect(readApiState(directory)).toMatchObject({ profile: 'plain', dirty: false });
    expect(snapshotsOf(root)).toHaveLength(1);
  });

  it('leaves the state dirty and releases the lock when a seed fails', async () => {
    const { ready, directory } = setup();

    expect(await ready('e2e', { runSeeds: async () => 7 })).toBe(7);
    expect(readApiState(directory)).toMatchObject({ dirty: true });
    expect(existsSync(lockPath(directory))).toBe(false);
  });

  it('stops when doctor cannot fix a check', async () => {
    const { ready, calls } = setup({ ...API, checks: [{ name: 'broken', check: 'exit 1', host: true }] });

    expect(await ready('e2e')).toBe(1);
    expect(calls.seeds).toEqual([]);
  });

  it('stops with the exit code of up', async () => {
    const { ready, calls } = setup();

    expect(await ready('e2e', { up: async () => 3 })).toBe(3);
    expect(calls.seeds).toEqual([]);
  });

  it('runs under the lock ETHLETE_API_LOCK names and leaves it held', async () => {
    const { ready, directory } = setup();
    const held = await acquireApiLock({ directory, command: 'et api run hub --lock', cwd: '/', wait: 0 });

    if (!held.ok) throw new Error('lock not taken');

    vi.stubEnv(API_LOCK_ENV, held.lock.token);

    expect(await ready('e2e')).toBe(0);
    expect(readApiLock(directory)?.token).toBe(held.lock.token);
  });

  it('gives up with 75 while another live process holds the lock', async () => {
    const { ready, directory, calls } = setup();

    await acquireApiLock({ directory, command: 'other', cwd: '/', wait: 0 });

    expect(await ready('e2e')).toBe(75);
    expect(calls.up).toBe(0);
  });

  it('retries the health check every 2 s until it answers the expected status', async () => {
    const { ready, sleeps } = setup();
    const statuses = [503, 502, 204];
    const fetch = vi.fn(async () => ({ status: statuses.shift() }) as Response);

    expect(await ready('healthy', { fetch })).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it('fails with the last error after 60 s of failed health checks', async () => {
    const { ready, sleeps } = setup();
    const fetch = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    expect(await ready('healthy', { fetch })).toBe(1);
    expect(sleeps).toHaveLength(30);
    expect(errors.join('\n')).toContain('did not answer 204 within 60 s. Last: connect ECONNREFUSED.');
  });
});

describe('waitForHealth', () => {
  it('caps each request at the time left of the total budget', async () => {
    let clock = 0;
    const timeouts: number[] = [];
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      timeouts.push(ms);

      return new AbortController().signal;
    });

    try {
      const result = await waitForHealth({
        url: 'http://x',
        expect: 200,
        timeoutMs: 15_000,
        retryMs: 2_000,
        now: () => clock,
        sleep: async (ms) => void (clock += ms + 3_000),
        fetch: (async () => new Response(null, { status: 503 })) as typeof fetch,
      });

      expect(result.ok).toBe(false);
      expect(timeouts).toEqual([10_000, 10_000, 5_000, 1]);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
