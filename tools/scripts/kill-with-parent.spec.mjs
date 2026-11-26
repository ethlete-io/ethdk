import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { tempDir } from './temp-dir.mjs';

const here = import.meta.dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const leftovers = new Set();

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

after(() => {
  for (const pid of leftovers) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
});

const waitFor = async (cond, ms = 10_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (cond()) return true;
  return false;
};

const readPid = async (file) => {
  assert.ok(await waitFor(() => existsSync(file) && readFileSync(file, 'utf8').trim()), `no ${file}`);
  const pid = Number(readFileSync(file, 'utf8'));
  leftovers.add(pid);
  return pid;
};

const start = (argv, env) => {
  const inherited = { ...process.env };
  delete inherited.HEAVY_MACHINE;
  const child = spawn(process.execPath, argv, { env: { ...inherited, ...env }, stdio: 'ignore', detached: true });
  leftovers.add(child.pid);
  return child;
};

test('heavy.mjs killed with SIGKILL leaves no job behind', { timeout: 30_000 }, async () => {
  const dir = tempDir('kill-with-parent-heavy-');
  const pidFile = join(dir, 'job.pid');
  const heavy = start([join(here, 'heavy.mjs'), 'run', '--', 'sh', '-c', `sleep 30 & echo $! > ${pidFile}; wait`], {
    HEAVY_ROUTE: 'off',
    HEAVY_LOCK_PREFIX: join(dir, 'lock'),
    RUN_REGISTRY_DIR: join(dir, 'runs'),
    KILL_WITH_PARENT_GRACE_MS: '500',
  });
  const job = await readPid(pidFile);
  process.kill(heavy.pid, 'SIGKILL');
  assert.ok(await waitFor(() => !isAlive(job)), `job ${job} still runs after heavy.mjs was killed`);
});

test('remote-run.mjs killed with SIGKILL takes its ssh session down', { timeout: 30_000 }, async () => {
  const dir = tempDir('kill-with-parent-remote-');
  const pidFile = join(dir, 'ssh.pid');
  writeFileSync(
    join(dir, 'ssh'),
    `#!/usr/bin/env bash
script=$(cat)
[[ "$script" == *for-each-ref* ]] && exit 0
echo $$ > ${pidFile}
exec sleep 30
`,
  );
  writeFileSync(join(dir, 'git'), `#!/usr/bin/env bash\n[ "$1" = rev-parse ] && echo ${'a'.repeat(40)}\nexit 0\n`);
  writeFileSync(join(dir, 'scp'), '#!/usr/bin/env bash\nexit 0\n');
  for (const name of ['ssh', 'git', 'scp']) chmodSync(join(dir, name), 0o755);
  const remote = start(
    [join(here, 'remote-run.mjs'), '--host', 'mac', '--log', join(dir, 'run.log'), '--', 'yarn test'],
    {
      PATH: `${dir}:${process.env.PATH}`,
      REMOTE_RUN_NO_REGISTRY: '1',
      KILL_WITH_PARENT_GRACE_MS: '500',
    },
  );
  const ssh = await readPid(pidFile);
  process.kill(remote.pid, 'SIGKILL');
  assert.ok(await waitFor(() => !isAlive(ssh)), `ssh ${ssh} still runs after remote-run.mjs was killed`);
});

test(
  'the remote guard kills the job and removes the slot containers once the session drops',
  { timeout: 30_000 },
  async () => {
    const dir = tempDir('kill-with-parent-guard-');
    const pidFile = join(dir, 'job.pid');
    const dockerLog = join(dir, 'docker.log');
    writeFileSync(
      join(dir, 'docker'),
      `#!/usr/bin/env bash\necho "$*" >> ${dockerLog}\n[ "$1" = ps ] && echo c0ffee\nexit 0\n`,
    );
    chmodSync(join(dir, 'docker'), 0o755);
    const guard = spawn(
      'bash',
      [join(here, 'remote-guard.sh'), 'w1', '--', 'sh', '-c', `echo $$ > ${pidFile}; sleep 30`],
      {
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RR_HEARTBEAT_S: '0.2', RR_GRACE_S: '0.2' },
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    leftovers.add(guard.pid);
    const job = await readPid(pidFile);
    guard.stdout.destroy();
    assert.ok(await waitFor(() => !isAlive(job)), `job ${job} still runs after the session dropped`);
    assert.ok(await waitFor(() => existsSync(dockerLog) && readFileSync(dockerLog, 'utf8').includes('rm -f c0ffee')));
    assert.match(readFileSync(dockerLog, 'utf8'), /ps -aq --filter label=ethlete-rr-slot=w1/);
  },
);
