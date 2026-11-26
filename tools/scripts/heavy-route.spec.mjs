import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { jobMachine, remoteSuite } from './heavy-route.mjs';
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
  writeFileSync(ssh, `#!/bin/sh\necho "$@" >> ${JSON.stringify(join(dir, 'ssh.calls'))}\nexit ${sshExit}\n`);
  chmodSync(ssh, 0o755);
  const runner = join(dir, 'fake-remote-run.mjs');
  writeFileSync(
    runner,
    `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(join(dir, 'remote.calls'))}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), noRegistry: process.env.REMOTE_RUN_NO_REGISTRY }) + '\\n');
console.log('remote-out');
process.exit(5);
`,
  );
  const env = {
    ...cleanEnv(),
    HEAVY_LOCK_PREFIX: join(dir, 'lock'),
    HEAVY_POLL_MS: '50',
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
  assert.match(result.stderr, /rack is down, running on tank/);
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
