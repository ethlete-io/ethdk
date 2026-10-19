import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { composeProjectName, apiStateDirectory, readApiState } from './api-state';
import { ApiDefinition } from './definition';
import { lockPath } from './lock';
import { runApiCommand } from './run';

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

const profile = (databases: string[]) => ({
  seeds: ['users'],
  snapshot: { service: 'database', databases, save: 'echo "dump of $DATABASES"', restore: 'cat > "$OUT"' },
});

const api: ApiDefinition = {
  composeDir: 'development',
  services: ['app', 'database'],
  execService: 'app',
  port: 8040,
  env: () => ({ OUT: join(tmpdir(), 'cli-api-restored.sql') }),
  profiles: { e2e: profile(['app']), other: profile(['audit']), plain: { seeds: [] } },
};

const setup = (definition = api) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-snap-run-'));
  const state = mkdtempSync(join(tmpdir(), 'cli-api-snap-state-'));

  vi.stubEnv('XDG_STATE_HOME', state);
  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api' } }), 'utf8');
  mkdirSync(join(root, 'api/development'), { recursive: true });

  const directory = apiStateDirectory({
    project: composeProjectName({ composePath: join(root, 'api/development'), env: {} }),
  });

  return { root, directory, run: (argv: string[]) => runApiCommand({ apis: { hub: definition }, argv, root }) };
};

beforeAll(() => {
  const directory = mkdtempSync(join(tmpdir(), 'cli-api-snap-bin-'));

  fakeBinary = join(directory, 'compose');
  writeFileSync(fakeBinary, `#!/bin/sh\nshift 4\nexec sh -c "$2"\n`);
  chmodSync(fakeBinary, 0o755);
});

afterEach(() => {
  errors.length = 0;
  logs.length = 0;
  vi.unstubAllEnvs();
});

describe('et api snapshot', () => {
  it('saves under .ethlete/snapshots/<api>/<name>-<fingerprint>.sql.gz and restores it as clean', async () => {
    const { root, directory, run } = setup();

    vi.stubEnv('OUT', join(tmpdir(), 'cli-api-restored.sql'));

    expect(await run(['snapshot', 'save', 'hub', 'base', '--profile', 'e2e'])).toBe(0);

    const [file] = readdirSync(join(root, '.ethlete/snapshots/hub'));

    expect(file).toMatch(/^base-[0-9a-f]{12}\.sql\.gz$/);
    expect(await run(['snapshot', 'restore', 'hub', 'base', '--profile', 'e2e'])).toBe(0);
    expect(readApiState(directory)).toMatchObject({
      profile: 'e2e',
      fingerprint: file?.slice(5, 17),
      dirty: false,
    });
    expect(existsSync(lockPath(directory))).toBe(false);
  });

  it('accepts the api before the action', async () => {
    const { root, run } = setup();

    expect(await run(['snapshot', 'hub', 'save', 'base', '--profile', 'e2e'])).toBe(0);
    expect(readdirSync(join(root, '.ethlete/snapshots/hub'))).toHaveLength(1);
  });

  it('needs --profile when several profiles declare a snapshot', async () => {
    const { run } = setup();

    expect(await run(['snapshot', 'save', 'hub', 'base'])).toBe(1);
    expect(errors[0]).toContain('several profiles');
    expect(errors[0]).toContain('e2e, other');
  });

  it('picks the only profile with a snapshot block', async () => {
    const { root, run } = setup({ ...api, profiles: { e2e: profile(['app']), plain: { seeds: [] } } });

    expect(await run(['snapshot', 'save', 'hub', 'base'])).toBe(0);
    expect(readdirSync(join(root, '.ethlete/snapshots/hub'))).toHaveLength(1);
  });

  it('rejects a profile without a snapshot block and a missing profile', async () => {
    const { run } = setup();

    expect(await run(['snapshot', 'save', 'hub', 'base', '--profile', 'plain'])).toBe(1);
    expect(errors[0]).toContain('declares no snapshot');
    expect(await run(['snapshot', 'save', 'hub', 'base', '--profile', 'nope'])).toBe(1);
    expect(errors[1]).toContain('no profile "nope"');
  });

  it('lists the existing files when the snapshot to restore is missing', async () => {
    const { run } = setup();

    await run(['snapshot', 'save', 'hub', 'other-name', '--profile', 'e2e']);

    expect(await run(['snapshot', 'restore', 'hub', 'base', '--profile', 'e2e'])).toBe(1);
    expect(errors[errors.length - 1]).toContain('other-name-');
  });

  it('rejects a name that could leave the snapshot directory', async () => {
    const { run } = setup();

    expect(await run(['snapshot', 'save', 'hub', '../x', '--profile', 'e2e'])).toBe(1);
    expect(errors[0]).toContain('not a snapshot name');
  });

  it('gives up on restore with 75 while another live process holds the lock', async () => {
    const { directory, run } = setup();

    mkdirSync(directory, { recursive: true });
    writeFileSync(
      lockPath(directory),
      JSON.stringify({ pid: process.pid, hostname: 'x', command: 'e2e', cwd: '/', startedAt: 'now', token: 't' }),
    );
    vi.stubEnv('OUT', join(tmpdir(), 'cli-api-restored.sql'));
    await run(['snapshot', 'save', 'hub', 'base', '--profile', 'e2e']);

    expect(await run(['snapshot', 'restore', 'hub', 'base', '--profile', 'e2e', '--wait', '0'])).toBe(75);
  });

  it('restores without taking the lock when ETHLETE_API_LOCK names the held one', async () => {
    const { directory, run } = setup();

    mkdirSync(directory, { recursive: true });
    writeFileSync(
      lockPath(directory),
      JSON.stringify({ pid: process.pid, hostname: 'x', command: 'e2e', cwd: '/', startedAt: 'now', token: 't' }),
    );
    vi.stubEnv('OUT', join(tmpdir(), 'cli-api-restored.sql'));
    vi.stubEnv('ETHLETE_API_LOCK', 't');
    await run(['snapshot', 'save', 'hub', 'base', '--profile', 'e2e']);

    expect(await run(['snapshot', 'restore', 'hub', 'base', '--profile', 'e2e'])).toBe(0);
    expect(existsSync(lockPath(directory))).toBe(true);
  });
});

describe('et api status', () => {
  it('prints the stored profile, both fingerprints, dirty, snapshot and lock', async () => {
    const { directory, run } = setup();

    vi.stubEnv('OUT', join(tmpdir(), 'cli-api-restored.sql'));
    await run(['snapshot', 'save', 'hub', 'base', '--profile', 'e2e']);
    await run(['snapshot', 'restore', 'hub', 'base', '--profile', 'e2e']);

    expect(await run(['status', 'hub'])).toBe(0);

    const text = logs.join('\n');
    const stored = readApiState(directory)?.fingerprint;

    expect(text).toMatch(/profile\s+e2e/);
    expect(text).toMatch(new RegExp(`stored\\s+${stored}`));
    expect(text).toMatch(new RegExp(`current\\s+${stored}`));
    expect(text).toMatch(/dirty\s+no/);
    expect(text).toMatch(new RegExp(`snapshot\\s+base-${stored}\\.sql\\.gz`));
    expect(text).toMatch(/lock\s+free/);
  });

  it('prints none and exits 0 for an API that never ran ready', async () => {
    const { run } = setup();

    expect(await run(['status', 'hub'])).toBe(0);
    expect(logs.join('\n')).toMatch(/profile\s+none/);
    expect(logs.join('\n')).toMatch(/dirty\s+unknown/);
  });

  it('says unreadable for a lock file it cannot parse, as acquiring treats it as held', async () => {
    const { directory, run } = setup();

    mkdirSync(directory, { recursive: true });
    writeFileSync(lockPath(directory), '{ broken', 'utf8');

    expect(await run(['status', 'hub'])).toBe(0);
    expect(logs.join('\n')).toContain(`unreadable (${lockPath(directory)})`);
  });
});
