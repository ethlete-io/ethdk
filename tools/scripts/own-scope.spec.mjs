import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  bytesOf,
  enterOwnScope,
  inOwnScope,
  OWN_SCOPE_ENV,
  parseOwnScopeArgs,
  scopeUnitOf,
  startTransientScopeArgs,
} from './own-scope.mjs';

const helper = fileURLToPath(new URL('./own-scope.mjs', import.meta.url));
const cgroupFile = (path) => () => `0::${path}\n`;
const userScopes =
  process.platform === 'linux' &&
  spawnSync('busctl', [
    '--user',
    'get-property',
    'org.freedesktop.systemd1',
    '/org/freedesktop/systemd1',
    'org.freedesktop.systemd1.Manager',
    'Version',
  ]).status === 0;

test('sizes and unit names', () => {
  assert.equal(bytesOf('512M'), String(512 * 1024 ** 2));
  assert.equal(bytesOf('8g'), String(8 * 1024 ** 3));
  assert.throws(() => bytesOf('lots'));
  assert.equal(scopeUnitOf('studio e2e', 42), 'studio-e2e-42.scope');
});

test('the transient scope caps memory, forbids swap and kills the whole job', () => {
  const args = startTransientScopeArgs('job-1.scope', 7, { memoryHigh: '1G', memoryMax: '2G' });
  const prop = (name) => args.slice(args.indexOf(name) + 1, args.indexOf(name) + 3);
  assert.deepEqual(prop('PIDs'), ['au', '1']);
  assert.equal(args[args.indexOf('PIDs') + 3], '7');
  assert.deepEqual(prop('MemoryMax'), ['t', String(2 * 1024 ** 3)]);
  assert.deepEqual(prop('MemorySwapMax'), ['t', '0']);
  assert.deepEqual(prop('OOMPolicy'), ['s', 'kill']);
  assert.ok(!args.includes('ManagedOOMPreference'));
  assert.equal(args.at(-1), '0');
  assert.equal(args[args.indexOf('fail') + 1], '7');
});

test('a child of a scoped job stays in that scope', () => {
  const env = { [OWN_SCOPE_ENV]: 'studio-e2e-9.scope' };
  assert.equal(inOwnScope(env, cgroupFile('/user.slice/app.slice/studio-e2e-9.scope')), true);
  assert.equal(inOwnScope(env, cgroupFile('/user.slice/app.slice/tmux-spawn-1.scope')), false);
  assert.equal(inOwnScope({}, cgroupFile('/user.slice/app.slice/studio-e2e-9.scope')), false);
  let called = false;
  const entered = enterOwnScope('studio-e2e', {
    env,
    platform: 'linux',
    readCgroup: cgroupFile('/user.slice/app.slice/studio-e2e-9.scope'),
    busctl: () => (called = true),
  });
  assert.deepEqual(entered, { ok: true, unit: 'studio-e2e-9.scope', inherited: true });
  assert.equal(called, false);
});

test('without a systemd user manager the job runs where it was started', () => {
  assert.deepEqual(enterOwnScope('studio-e2e', { platform: 'darwin', busctl: () => assert.fail() }), {
    ok: false,
    reason: 'not linux',
  });
  const lines = [];
  const entered = enterOwnScope('studio-e2e', {
    env: {},
    platform: 'linux',
    readCgroup: cgroupFile('/'),
    busctl: () => {
      throw Object.assign(new Error('failed'), { stderr: 'Failed to connect to bus: No medium found\n' });
    },
    log: (line) => lines.push(line),
  });
  assert.equal(entered.ok, false);
  assert.match(lines[0], /No medium found/);
});

test('the command line takes the job limits or explicit ones', () => {
  assert.deepEqual(parseOwnScopeArgs(['studio-e2e', '--', 'node', 'x']).limits, {
    memoryHigh: '32G',
    memoryMax: '40G',
  });
  assert.deepEqual(parseOwnScopeArgs(['hog', '--memory-max', '256M', '--', 'node']).limits, {
    memoryHigh: '256M',
    memoryMax: '256M',
  });
  assert.equal(parseOwnScopeArgs(['hog', '--', 'node']), undefined);
  assert.equal(parseOwnScopeArgs(['studio-e2e']), undefined);
});

test('a hog past its cap dies in its own scope and the launching process survives', { skip: !userScopes }, () => {
  const hog = `const keep = []; for (let mb = 0; mb < 768; mb += 16) keep.push(Buffer.alloc(16 * 1024 * 1024, 1)); console.log('not killed');`;
  const script = `${hog}`;
  const run = spawnSync(
    process.execPath,
    [helper, 'own-scope-spec', '--memory-max', '256M', '--', process.execPath, '-e', script],
    { encoding: 'utf8', env: { ...process.env, [OWN_SCOPE_ENV]: '' } },
  );
  assert.doesNotMatch(run.stdout, /not killed/);
  assert.match(run.stderr, /runs in own-scope-spec-\d+\.scope/);
  assert.equal(run.signal, 'SIGKILL');
  assert.doesNotMatch(readFileSync('/proc/self/cgroup', 'utf8'), /own-scope-spec-/);
});
