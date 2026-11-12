import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const wrapper = join(dirname(fileURLToPath(import.meta.url)), 'et-design.mjs');
const stateDir = mkdtempSync(join(tmpdir(), 'et-design-spec-'));
const fakeCli = join(stateDir, 'fake-cli.mjs');
const started = new Set();

writeFileSync(
  fakeCli,
  `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(stateDir)} + '/cli-' + process.argv.slice(3).join('-') + '.pid', String(process.pid));
setInterval(() => undefined, 1000);
`,
);

const env = { ...process.env, ETHLETE_DESIGN_STATE_DIR: stateDir, ETHLETE_DESIGN_CLI_ENTRY: fakeCli };

const alive = (pid) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const until = async (check, ms) => {
  const end = Date.now() + ms;

  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((done) => setTimeout(done, 50));
  }

  return check();
};

const cliPidOf = async (name) => {
  const file = join(stateDir, `cli-${name}.pid`);

  assert.ok(
    await until(() => existsSync(file) && readFileSync(file, 'utf8') !== '', 10_000),
    `the fake cli ${name} started`,
  );

  const pid = Number(readFileSync(file, 'utf8'));

  started.add(pid);

  return pid;
};

after(() => {
  for (const pid of started) if (alive(pid)) process.kill(pid, 'SIGKILL');
  rmSync(stateDir, { recursive: true, force: true });
});

test('ends the wrapper and its cli when the shell that started it dies', async () => {
  const shell = spawn('sh', ['-c', `echo $$; "${process.execPath}" "${wrapper}" orphan; :`], {
    env,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const cli = await cliPidOf('orphan');
  const wrapperPid = Number(spawnSync('ps', ['-o', 'ppid=', '-p', String(cli)], { encoding: 'utf8' }).stdout.trim());

  started.add(wrapperPid);
  shell.kill('SIGKILL');

  assert.ok(await until(() => !alive(wrapperPid) && !alive(cli), 10_000), 'no et-design process remains');
});

test('refuses a second run of the same command and names the pid of the first', async () => {
  const first = spawn(process.execPath, [wrapper, 'twice'], { env, stdio: 'ignore' });
  const cli = await cliPidOf('twice');

  started.add(first.pid);

  const second = spawnSync(process.execPath, [wrapper, 'twice'], { env, encoding: 'utf8', timeout: 10_000 });

  assert.equal(second.status, 1);
  assert.match(second.stderr, new RegExp(`already runs as pid ${first.pid}\\b`));

  first.kill('SIGTERM');

  assert.ok(await until(() => !alive(cli), 10_000), 'SIGTERM reached the cli');
});

test('ends a run past its deadline with a log', async () => {
  const run = spawnSync(process.execPath, [wrapper, 'shot', 'stuck'], {
    env: { ...env, ETHLETE_DESIGN_DEADLINE_MS: '300' },
    encoding: 'utf8',
    timeout: 15_000,
  });
  const cli = await cliPidOf('shot-stuck');
  const log = /log: (\S+)/.exec(run.stderr)?.[1];

  assert.equal(run.status, 124);
  assert.ok(log && existsSync(log), `a log is named: ${run.stderr}`);
  assert.match(readFileSync(log, 'utf8'), /design shot stuck did not end within/);
  assert.ok(await until(() => !alive(cli), 10_000), 'the cli ended');
});

test('runs an injected cli outside a git checkout, and refuses to build the CLI copy there', async (t) => {
  const copy = mkdtempSync(join(tmpdir(), 'et-design-spec-export-'));

  t.after(() => rmSync(copy, { recursive: true, force: true }));
  mkdirSync(join(copy, 'tools', 'scripts'), { recursive: true });
  for (const name of ['et-design.mjs', 'studio-code.mjs'])
    copyFileSync(join(dirname(wrapper), name), join(copy, 'tools', 'scripts', name));

  const copied = join(copy, 'tools', 'scripts', 'et-design.mjs');
  const run = spawn(process.execPath, [copied, 'export'], { env, stdio: 'ignore' });

  started.add(run.pid);
  await cliPidOf('export');
  run.kill('SIGTERM');

  const refused = spawnSync(process.execPath, [copied, 'export'], {
    env: { ...env, ETHLETE_DESIGN_CLI_ENTRY: '' },
    encoding: 'utf8',
    timeout: 10_000,
  });

  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /is no git checkout/);
});
