import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './git-test-env.mjs';
import { LINUX_IMAGE, parseArgs, remoteScript } from './remote-run.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'remote-run.mjs');
const SHA = 'a'.repeat(40);

const stubDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-'));
  writeFileSync(
    join(dir, 'ssh'),
    `#!/usr/bin/env bash
script=$(cat)
printf '%s\\n' "$*" >> "$STUB_LOG"
if [[ "$script" == *"for-each-ref"* && -n "$FAKE_HAVE" ]]; then echo "have $FAKE_HAVE"; fi
if [[ "$script" == *"suite exit"* ]]; then echo "suite output"; exit "\${FAKE_SUITE_CODE:-0}"; fi
exit 0
`,
  );
  writeFileSync(
    join(dir, 'git'),
    `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> "$STUB_LOG"
[ "$1" = rev-parse ] && echo ${SHA}
[ "$1" = bundle ] && touch "$4"
[ "$1" = merge-base ] && [ -z "$FAKE_ANCESTOR" ] && exit 1
exit 0
`,
  );
  writeFileSync(join(dir, 'scp'), `#!/usr/bin/env bash\nprintf 'scp %s\\n' "$*" >> "$STUB_LOG"\n`);
  chmodSync(join(dir, 'scp'), 0o755);
  chmodSync(join(dir, 'ssh'), 0o755);
  chmodSync(join(dir, 'git'), 0o755);
  return dir;
};

const run = (args, env = {}) => {
  const dir = stubDir();
  const stubLog = join(dir, 'calls.log');
  const log = join(dir, 'run.log');
  mkdirSync(join(dir, 'runs'));
  const result = spawnSync(process.execPath, [SCRIPT, ...args.map((a) => (a === '$LOG' ? log : a))], {
    encoding: 'utf8',
    env: gitEnv({
      PATH: `${dir}:${process.env.PATH}`,
      STUB_LOG: stubLog,
      TMPDIR: dir,
      RUN_REGISTRY_DIR: join(dir, 'runs'),
      ...env,
    }),
  });
  const read = (file) => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  };
  const out = {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls: read(stubLog),
    log: read(log),
    runs: readdirSync(join(dir, 'runs'), { withFileTypes: true })
      .filter((e) => e.name.endsWith('.json'))
      .map((e) => JSON.parse(read(join(dir, 'runs', e.name)))),
    logPath: log,
  };
  rmSync(dir, { recursive: true });
  return out;
};

test('parses host, ref, slot and the suite after --', () => {
  assert.deepEqual(parseArgs(['--host', 'rack', '--ref', 'abc', '--', 'yarn', 'nx', 'run-many', '-t', 'test']), {
    host: 'rack',
    ref: 'abc',
    slot: 'w1',
    log: undefined,
    suite: 'yarn nx run-many -t test',
  });
  assert.equal(parseArgs(['--host', 'mac', '--', 'true']).ref, 'HEAD');
});

test('rejects an unknown host, a missing suite and unknown options', () => {
  assert.throws(() => parseArgs(['--host', 'tank', '--', 'true']), /--host must be one of rack, mac/);
  assert.throws(() => parseArgs(['--host', 'rack']), /missing suite command/);
  assert.throws(() => parseArgs(['--host', 'rack', '--fast', '--', 'true']), /unknown or incomplete option --fast/);
  assert.throws(() => parseArgs(['--host', 'rack', '--slot', '../x', '--', 'true']), /--slot/);
});

test('refuses picture-comparing suites outside the Linux container', () => {
  assert.throws(() => parseArgs(['--host', 'rack', '--', 'yarn playwright test --project=visual']), /add --linux/);
  assert.throws(() => parseArgs(['--host', 'mac', '--', 'yarn nx run storybook:visual']), /add --linux/);
  assert.equal(parseArgs(['--host', 'mac', '--linux', '--', 'yarn playwright test --project=visual']).linux, true);
  assert.doesNotThrow(() => parseArgs(['--host', 'rack', '--', 'STUDIO_E2E_SHARD=1/10 yarn studio:e2e']));
});

test('exits with the suite exit code and tees the log', () => {
  const failed = run(['--host', 'rack', '--log', '$LOG', '--', 'yarn test'], { FAKE_SUITE_CODE: '7' });
  assert.equal(failed.status, 7);
  assert.match(failed.stdout, /suite output/);
  assert.match(failed.log, /suite output/);
  assert.match(failed.calls, /git bundle create --quiet \S+ refs\/remote-run\/a{40}\n/);
  assert.match(failed.calls, /scp -q (-o \S+ )+\S+ trbor@192\.168\.1\.115:ethlete-rr-a{12}\.bundle/);
  assert.doesNotMatch(failed.calls, /git push|origin/);

  assert.equal(run(['--host', 'mac', '--', 'yarn test']).status, 0);
});

test('sends no bundle when the commit is an ancestor of a ref the remote mirror has', () => {
  const reached = run(['--host', 'rack', '--', 'yarn test'], { FAKE_HAVE: 'b'.repeat(40), FAKE_ANCESTOR: '1' });
  assert.equal(reached.status, 0);
  assert.match(reached.calls, /git merge-base --is-ancestor a{40} b{40}/);
  assert.doesNotMatch(reached.calls, /git bundle|scp/);

  const unreached = run(['--host', 'rack', '--', 'yarn test'], { FAKE_HAVE: 'b'.repeat(40) });
  assert.match(unreached.calls, /git bundle create --quiet \S+ refs\/remote-run\/a{40} \^b{40}\n/);
});

test('--linux runs the suite in the pinned Playwright image, on the rack through the WSL helper', () => {
  const mac = run(['--host', 'mac', '--linux', '--', 'yarn test'], { FAKE_SUITE_CODE: '3' });
  assert.equal(mac.status, 3);
  assert.match(mac.calls, /ethlete-mac bash -l -s/);

  const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'yarn test', host: 'mac', linux: true });
  assert.match(
    script,
    new RegExp(`docker run --rm --init --ipc=host .*\\n.*\\n.*\\n.*\\n *${LINUX_IMAGE.replace(/[.]/g, '\\.')} bash -c`),
  );
  assert.match(script, /work="\$HOME\/ethlete-rr\/w1-linux"/);

  const rack = remoteScript({
    sha: SHA,
    slot: 'w1',
    suite: 'yarn test',
    host: 'rack',
    linux: true,
    rackHelper: 'echo helper\n',
  });
  assert.match(
    rack,
    /MSYS_NO_PATHCONV=1 wsl\.exe -d ethlete -- bash \/mnt\/c\/Users\/trbor\/ethlete-rr\/rack-docker-run\.sh "\$sha" 'w1' -- 'yarn test'/,
  );
  assert.doesNotMatch(rack, /worktree add/);
});

test('exits 2 on bad arguments without calling ssh', () => {
  const result = run(['--host', 'nope', '--', 'true']);
  assert.equal(result.status, 2);
  assert.equal(result.calls, '');
});

test('registers the run in the run registry with its machine, log and exit code', () => {
  const rack = run(['--host', 'rack', '--log', '$LOG', '--', 'yarn e2e'], { FAKE_SUITE_CODE: '5' });
  assert.equal(rack.runs.length, 1);
  assert.equal(rack.runs[0].machine, 'rack');
  assert.equal(rack.runs[0].log, rack.logPath);
  assert.equal(rack.runs[0].label, 'remote-run yarn e2e');
  assert.equal(rack.runs[0].exitCode, 5);

  assert.equal(run(['--host', 'mac', '--', 'yarn test']).runs[0].machine, 'mac');
});

test('a native run installs and runs the suite inside its slot checkout', () => {
  const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'node --test a.spec.mjs', host: 'mac', linux: false });
  const work = mkdtempSync(join(tmpdir(), 'remote-run-native-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\npwd > "$HOME/yarn-cwd"\n');
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\npwd > "$HOME/suite-cwd"\n');
  for (const name of ['git', 'yarn', 'node']) chmodSync(join(bin, name), 0o755);
  try {
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const slot = join(home, 'ethlete-rr', 'w1');
    assert.equal(readFileSync(join(home, 'yarn-cwd'), 'utf8').trim(), slot);
    assert.equal(readFileSync(join(home, 'suite-cwd'), 'utf8').trim(), slot);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the rack helper holds a per-slot lock before it touches the slot checkout', () => {
  const helper = readFileSync(join(dirname(SCRIPT), 'rack-docker-run.sh'), 'utf8');
  const lock = helper.indexOf('flock 9');
  assert.ok(lock > 0, 'no flock');
  assert.ok(helper.indexOf('$slot.lock') < lock);
  assert.ok(lock < helper.indexOf('checkout --quiet --force'));
});
