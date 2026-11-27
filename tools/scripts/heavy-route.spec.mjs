import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { jobIsPinned, jobMachine, machineOrder, probeScript, probeVerdict, remoteSuite } from './heavy-route.mjs';
import { NO_VERDICT_EXIT } from './remote-run.mjs';
import { tempDir } from './temp-dir.mjs';

const heavy = new URL('./heavy.mjs', import.meta.url).pathname;
const holders = new Set();

after(() => {
  for (const child of holders) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
});

const cleanEnv = () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') || key.startsWith('HEAVY_')) delete env[key];
  delete env['REMOTE_RUN_NO_REGISTRY'];
  return env;
};

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: cleanEnv() });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

const setup = ({ sshExit = 0 } = {}) => {
  const dir = realpathSync(tempDir('heavy-route-spec-'));
  const repo = join(dir, 'other repo');
  mkdirSync(join(repo, 'pkg'), { recursive: true });
  git(repo, 'init', '--quiet');
  git(repo, 'config', 'user.email', 'spec@localhost');
  git(repo, 'config', 'user.name', 'spec');
  writeFileSync(join(repo, 'pkg', 'a.txt'), 'committed\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '--quiet', '-m', 'init');

  const ssh = join(dir, 'fake-ssh');
  writeFileSync(
    ssh,
    `#!/bin/sh
echo "$@" >> ${JSON.stringify(join(dir, 'ssh.calls'))}
cat >/dev/null
case "$5" in *@*) host=rack ;; *) host=mac ;; esac
probe=${JSON.stringify(dir)}/probe-$host
if [ -f "$probe" ]; then cat "$probe"; exit 1; fi
echo free_kb=99999999 disk=home
echo heavy-probe-ok
exit ${sshExit}
`,
  );
  chmodSync(ssh, 0o755);
  const runner = join(dir, 'fake-remote-run.mjs');
  writeFileSync(
    runner,
    `import { appendFileSync, existsSync, readFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(join(dir, 'remote.calls'))}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), noRegistry: process.env.REMOTE_RUN_NO_REGISTRY }) + '\\n');
console.log('remote-out');
const host = process.argv[process.argv.indexOf('--host') + 1];
process.exit(existsSync(${JSON.stringify(dir)} + '/exit-' + host) ? Number(readFileSync(${JSON.stringify(dir)} + '/exit-' + host, 'utf8')) : 5);
`,
  );
  const env = {
    ...cleanEnv(),
    HEAVY_LOCK_PREFIX: join(dir, 'lock'),
    HEAVY_POLL_MS: '50',
    HEAVY_MAX_LOAD: '100000',
    HEAVY_SSH: ssh,
    HEAVY_REMOTE_RUN: runner,
    RUN_REGISTRY_DIR: join(dir, 'runs'),
    RUN_MACHINE: 'tank',
  };
  const runHeavy = (args, cwd = repo) =>
    spawnSync(process.execPath, [heavy, 'run', ...args], { cwd, env, encoding: 'utf8', timeout: 20_000 });
  const remoteCalls = () => {
    try {
      return readFileSync(join(dir, 'remote.calls'), 'utf8').trim().split('\n').map(JSON.parse);
    } catch {
      return [];
    }
  };
  const entries = () =>
    readdirSync(join(dir, 'runs'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(dir, 'runs', name), 'utf8')));
  const hold = (lock) => {
    const child = spawn('flock', [lock, 'sleep', '60'], { detached: true, stdio: 'ignore' });
    holders.add(child);
    return child;
  };
  return { dir, repo, env, runHeavy, remoteCalls, entries, hold };
};

const waitForLock = (lock) => {
  for (let i = 0; i < 100; i++) {
    if (spawnSync('flock', ['-n', lock, 'true']).status !== 0) return;
    spawnSync('sleep', ['0.05']);
  }
  assert.fail(`${lock} was never taken`);
};

test('a command goes to the machine of its job class', () => {
  const table = [
    [['npx', 'nx', 'lint', 'cli'], 'rack'],
    [['npx nx run-many -t test --projects=components'], 'rack'],
    [['node', '--test', 'tools/scripts/a.spec.mjs', 'tools/scripts/b.spec.mjs'], 'rack'],
    [['npx', 'vitest', 'run', '--coverage'], 'rack'],
    [['npx', 'vitest', 'related', '--run', 'libs/cli/src/lib/design/thumb.spec.ts'], 'mac'],
    [['npx', 'playwright', 'test', '--project=webkit'], 'mac'],
    [['yarn', 'studio:e2e', '--engine', 'webkit', '--workers', '2'], 'tank'],
    [['node', 'apps/ethlete-studio/e2e/canvas.e2e.mjs', '--engine', 'webkit'], 'tank'],
    [['npx', 'nx', 'lint', 'cli', '--fix'], 'tank'],
    [['npx', 'prettier', '--write', 'a.ts'], 'tank'],
    [['npx', 'playwright', 'test', '--project=visual'], 'tank'],
    [['npx', 'nx', 'run', 'cli:build'], 'tank'],
    [['npx', 'nx', 'e2e', 'ethlete-studio'], 'tank'],
    [['node', 'dist/libs/cli/bin.js', 'design', 'check'], 'tank'],
    [['sh', '-c', 'echo hi'], 'tank'],
  ];
  for (const [command, machine] of table) assert.equal(jobMachine(command), machine, command.join(' '));
});

test('the remote suite keeps the caller directory and quoting', () => {
  assert.equal(remoteSuite(['npx', 'vitest', 'run'], ''), 'npx vitest run');
  assert.equal(remoteSuite(['sh', '-c', "echo 'a b'"], 'libs/x y'), `cd 'libs/x y' && sh -c 'echo '\\''a b'\\'''`);
});

test('a lint run goes to rack with a snapshot of the working tree and registers rack', () => {
  const { repo, runHeavy, remoteCalls, entries } = setup();
  writeFileSync(join(repo, 'pkg', 'a.txt'), 'dirty\n');
  writeFileSync(join(repo, 'new.txt'), 'untracked\n');
  const headBefore = git(repo, 'rev-parse', 'HEAD');

  const result = runHeavy(['--', 'npx', 'nx', 'lint', 'cli']);

  assert.equal(result.status, 5, result.stderr);
  assert.match(result.stdout, /remote-out/);
  const [call] = remoteCalls();
  const at = (flag) => call.argv[call.argv.indexOf(flag) + 1];
  assert.equal(at('--host'), 'rack');
  assert.ok(call.argv.includes('--linux'));
  assert.equal(at('--slot'), 'heavy-other-repo-1');
  assert.equal(call.argv.at(-1), 'npx nx lint cli');
  assert.equal(call.noRegistry, '1');
  assert.equal(git(repo, 'show', `${at('--ref')}:pkg/a.txt`), 'dirty');
  assert.equal(git(repo, 'show', `${at('--ref')}:new.txt`), 'untracked');
  assert.equal(git(repo, 'rev-parse', 'HEAD'), headBefore);
  assert.equal(git(repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(git(repo, 'status', '--porcelain'), 'M pkg/a.txt\n?? new.txt');

  const [entry] = entries();
  assert.equal(entry.machine, 'rack');
  assert.equal(entry.exitCode, 5);
  assert.match(readFileSync(entry.log, 'utf8'), /\[heavy\] rack slot 1\nremote-out/);
});

test('a call from a subdirectory of another repo runs there on the remote side', () => {
  const { repo, runHeavy, remoteCalls } = setup();
  const result = runHeavy(['--', 'npx', 'nx', 'lint', 'cli'], join(repo, 'pkg'));
  assert.equal(result.status, 5, result.stderr);
  const [call] = remoteCalls();
  assert.equal(call.cwd, repo);
  assert.equal(call.argv.at(-1), 'cd pkg && npx nx lint cli');
  assert.equal(call.argv[call.argv.indexOf('--ref') + 1], git(repo, 'rev-parse', 'HEAD'));
});

test('a worktree of the other repo shares the remote slots of its main checkout', () => {
  const { dir, repo, runHeavy, remoteCalls } = setup();
  const worktree = join(dir, 'other-repo-b-60');
  git(repo, 'worktree', 'add', '--quiet', '--detach', worktree);
  assert.equal(runHeavy(['--', 'npx', 'nx', 'lint', 'cli'], worktree).status, 5);
  const [call] = remoteCalls();
  assert.equal(call.cwd, worktree);
  assert.equal(call.argv[call.argv.indexOf('--slot') + 1], 'heavy-other-repo-1');
});

test('a rack job runs on tank when rack is down', () => {
  const { runHeavy, remoteCalls, entries } = setup({ sshExit: 255 });
  const result = runHeavy(['--', 'sh', '-c', 'echo lint-ran-local; exit 3']);
  assert.equal(result.status, 3);
  assert.match(result.stdout, /lint-ran-local/);
  assert.match(result.stderr, /rack does not answer, skipping it/);
  assert.deepEqual(remoteCalls(), []);
  assert.equal(entries()[0].machine, 'tank');
});

test('a rack job runs on tank when both rack slots are taken and tank is free', () => {
  const { dir, runHeavy, remoteCalls, entries, hold } = setup();
  for (const n of [1, 2]) {
    hold(join(dir, `lock.rack-${n}.lock`));
    waitForLock(join(dir, `lock.rack-${n}.lock`));
  }
  const result = runHeavy(['--', 'sh', '-c', 'echo lint-ran-local']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /lint-ran-local/);
  assert.match(result.stderr, /rack slots are taken, running on tank/);
  assert.deepEqual(remoteCalls(), []);
  const [entry] = entries();
  assert.equal(entry.machine, 'tank');
  assert.match(readFileSync(entry.log, 'utf8'), /\[heavy\] slot 1\nlint-ran-local/);
});

test('--on and HEAVY_ROUTE=off pick the machine by hand', () => {
  const { runHeavy, remoteCalls, env } = setup();
  assert.equal(runHeavy(['--on', 'mac', '--', 'sh', '-c', 'echo x']).status, 5);
  assert.equal(remoteCalls()[0].argv[remoteCalls()[0].argv.indexOf('--host') + 1], 'mac');
  env.HEAVY_ROUTE = 'off';
  assert.equal(runHeavy(['--', 'sh', '-c', 'echo lint; exit 0']).status, 0);
  assert.equal(remoteCalls().length, 1);
  assert.equal(runHeavy(['--on', 'moon', '--', 'true']).status, 2);
});

test('--env, --forward and --yarn-cache reach remote-run, --yarn-cache only for rack', () => {
  const { runHeavy, remoteCalls } = setup();
  const args = ['--env', 'NPM_TOKEN', '--forward', '8000', '--yarn-cache', '--', 'npx', 'nx', 'lint', 'cli'];
  assert.equal(runHeavy(['--on', 'rack', ...args]).status, 5);
  assert.equal(runHeavy(['--on', 'mac', ...args]).status, 5);
  const [rack, mac] = remoteCalls();
  const own = (call) => call.argv.slice(call.argv.indexOf('--slot') + 2, call.argv.indexOf('--'));
  assert.deepEqual(own(rack), ['--env', 'NPM_TOKEN', '--forward', '8000', '--yarn-cache']);
  assert.deepEqual(own(mac), ['--env', 'NPM_TOKEN', '--forward', '8000']);
  assert.equal(runHeavy(['--yarnCache', 'x', '--', 'true']).status, 2);
});

test('a movable job leaves a loaded tank for the first usable remote, and waits on tank when none is', () => {
  const order = (preferred, { movable = true, loaded = true, up = ['rack', 'mac'] } = {}) =>
    machineOrder({ preferred, movable, tankLoaded: () => loaded, usable: (machine) => up.includes(machine) });

  assert.deepEqual(order('tank', { loaded: false }), ['tank']);
  assert.deepEqual(order('tank'), ['rack', 'mac', 'tank']);
  assert.deepEqual(order('tank', { up: ['mac'] }), ['mac', 'tank']);
  assert.deepEqual(order('tank', { up: [] }), ['tank']);
  assert.deepEqual(order('tank', { movable: false }), ['tank']);
  assert.deepEqual(order('rack', { loaded: false }), ['rack', 'tank']);
  assert.deepEqual(order('rack'), ['rack', 'mac', 'tank']);
  assert.deepEqual(order('rack', { up: ['mac'] }), ['mac', 'tank']);
  assert.deepEqual(order('mac'), ['mac', 'rack', 'tank']);
  assert.deepEqual(order('mac', { movable: false, up: [] }), ['tank']);
});

test('a machine whose WSL fails or whose disk is full is unusable', () => {
  assert.match(probeScript('rack'), /df -Pk \/c/);
  assert.match(probeScript('rack'), /wsl\.exe -d ethlete --exec bash -c .*docker info/);
  assert.doesNotMatch(probeScript('mac'), /wsl/);
  const ok = 'free_kb=99999999 disk=C:\nfree_kb=99999999 disk=wsl\nheavy-probe-ok\n';
  assert.deepEqual(probeVerdict({ status: 0, stdout: ok }), { usable: true });
  assert.deepEqual(probeVerdict({ status: 255, stdout: '' }), { usable: false, reason: 'does not answer' });
  assert.deepEqual(probeVerdict({ status: null, stdout: '' }), { usable: false, reason: 'does not answer' });
  assert.deepEqual(probeVerdict({ status: 0, stdout: 'free_kb=3145728 disk=C:\nheavy-probe-ok\n' }), {
    usable: false,
    reason: 'has 3.0 GB free on C:',
  });
  assert.deepEqual(probeVerdict({ status: 127, stdout: 'free_kb=99999999 disk=C:\n' }), {
    usable: false,
    reason: 'fails its probe (exit 127)',
  });
});

test('jobs that write the tree, compare pictures, need cargo or a tank server stay pinned to tank', () => {
  assert.equal(jobIsPinned(['npx', 'nx', 'build', 'core']), false);
  assert.equal(jobIsPinned(['npx', 'nx', 'e2e', 'timetrack-e2e']), false);
  assert.equal(jobIsPinned(['npx', 'nx', 'lint', 'core', '--fix']), true);
  assert.equal(jobIsPinned(['npx', 'playwright', 'test', '--project=visual']), true);
  assert.equal(jobIsPinned(['yarn', 'studio:e2e']), true);
  assert.equal(jobIsPinned(['npx', 'nx', 'run', 'storybook:test-storybook']), true);
});

const loadTank = ({ dir, env, hold }) => {
  env.HEAVY_SLOTS = '1';
  const holder = hold(join(dir, 'lock.lock'));
  waitForLock(join(dir, 'lock.lock'));
  return holder;
};

test('a --movable build runs on rack while tank is loaded', () => {
  const ctx = setup();
  loadTank(ctx);
  const result = ctx.runHeavy(['--movable', '--', 'npx', 'nx', 'build', 'core']);
  assert.equal(result.status, 5, result.stderr);
  assert.match(result.stderr, /tank is loaded, trying rack, mac, tank/);
  const [call] = ctx.remoteCalls();
  assert.equal(call.argv[call.argv.indexOf('--host') + 1], 'rack');
  assert.equal(ctx.entries()[0].machine, 'rack');
});

test('a build without --movable waits for a loaded tank', () => {
  const ctx = setup();
  ctx.env.HEAVY_SLOTS = '1';
  const lock = join(ctx.dir, 'lock.lock');
  holders.add(spawn('flock', [lock, 'sleep', '1'], { detached: true, stdio: 'ignore' }));
  waitForLock(lock);
  const started = Date.now();
  const result = spawnSync(process.execPath, [heavy, 'run', '--', 'sh', '-c', 'echo build-ran-local'], {
    cwd: ctx.repo,
    env: ctx.env,
    encoding: 'utf8',
    timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /build-ran-local/);
  assert.ok(Date.now() - started > 500);
  assert.deepEqual(ctx.remoteCalls(), []);
});

test('a loaded tank skips an unusable rack for mac', () => {
  const ctx = setup();
  loadTank(ctx);
  writeFileSync(join(ctx.dir, 'probe-rack'), 'free_kb=3145728 disk=C:\n');
  const result = ctx.runHeavy(['--', 'npx', 'nx', 'test', 'core']);
  assert.equal(result.status, 5, result.stderr);
  assert.match(result.stderr, /rack has 3\.0 GB free on C:, skipping it/);
  const [call] = ctx.remoteCalls();
  assert.equal(call.argv[call.argv.indexOf('--host') + 1], 'mac');
  assert.equal(call.argv.includes('--linux'), false);
  assert.equal(ctx.entries()[0].machine, 'mac');
});

test('a remote run without a verdict moves on to the next machine', () => {
  const ctx = setup();
  loadTank(ctx);
  writeFileSync(join(ctx.dir, 'exit-rack'), String(NO_VERDICT_EXIT));
  const result = ctx.runHeavy(['--', 'npx', 'nx', 'test', 'core']);
  assert.equal(result.status, 5, result.stderr);
  assert.match(result.stderr, /rack ended without a verdict, trying the next machine/);
  assert.deepEqual(
    ctx.remoteCalls().map(({ argv }) => argv[argv.indexOf('--host') + 1]),
    ['rack', 'mac'],
  );
  assert.equal(ctx.entries()[0].machine, 'mac');
});

test('a rack job runs on tank when its rack run ends without a verdict', () => {
  const ctx = setup();
  writeFileSync(join(ctx.dir, 'exit-rack'), String(NO_VERDICT_EXIT));
  const result = ctx.runHeavy(['--', 'sh', '-c', 'echo ran-on-tank vitest']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ran-on-tank vitest/);
  assert.equal(ctx.remoteCalls().length, 1);
});

test('with every slot on every machine taken a run waits for the first free one', async () => {
  const ctx = setup();
  const tank = loadTank(ctx);
  for (const lock of ['lock.rack-1.lock', 'lock.rack-2.lock', 'lock.mac-1.lock']) {
    ctx.hold(join(ctx.dir, lock));
    waitForLock(join(ctx.dir, lock));
  }
  const child = spawn(process.execPath, [heavy, 'run', '--movable', '--', 'sh', '-c', 'echo e2e-ran-local'], {
    cwd: ctx.repo,
    env: ctx.env,
    detached: true,
  });
  holders.add(child);
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (err += d));
  const done = new Promise((r) => child.on('close', r));
  for (let i = 0; i < 100 && !/all 4 slots are taken/.test(err); i++) await new Promise((r) => setTimeout(r, 50));
  assert.match(err, /all 4 slots are taken/);
  process.kill(-tank.pid, 'SIGKILL');
  assert.equal(await done, 0, err);
  assert.match(out, /e2e-ran-local/);
  assert.match(err, /rack, mac slots are taken, running on tank/);
});
