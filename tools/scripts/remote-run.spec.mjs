import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './git-test-env.mjs';
import {
  initScript,
  LINUX_IMAGE,
  lfsFiles,
  neededCacheFiles,
  NO_VERDICT_EXIT,
  parseArgs,
  remoteScript,
} from './remote-run.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'remote-run.mjs');
const SHA = 'a'.repeat(40);

const stubDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-'));
  writeFileSync(
    join(dir, 'ssh'),
    `#!/usr/bin/env bash
script=$(cat)
printf '%s\\n' "$*" >> "$STUB_LOG"
if [[ "$script" == *"for-each-ref"* && -n "$FAKE_HAVE" ]]; then for have in $FAKE_HAVE; do echo "have $have"; done; fi
if [[ "$script" == *"suite exit"* ]]; then
  echo "suite output"
  [ -n "$FAKE_NO_VERDICT" ] || printf '[remote-run] suite exit %s after 1s\\n' "\${FAKE_SUITE_CODE:-0}"
  exit "\${FAKE_SUITE_CODE:-0}"
fi
[ -n "$FAKE_INIT_CODE" ] && [[ "$script" == *"for-each-ref"* ]] && exit "$FAKE_INIT_CODE"
exit 0
`,
  );
  writeFileSync(
    join(dir, 'git'),
    `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> "$STUB_LOG"
[ "$1" = rev-parse ] && [ "$2" = --show-toplevel ] && { echo "$FAKE_TOP"; exit 0; }
[ "$1" = rev-parse ] && echo ${SHA}
[ "$1" = bundle ] && touch "$4"
[ "$1" = cat-file ] && { while read -r have; do echo "$have commit"; done; exit 0; }
[ "$1" = rev-list ] && { cat > /dev/null; [ -n "$FAKE_ANCESTOR" ] || echo ${SHA}; exit 0; }
exit 0
`,
  );
  writeFileSync(
    join(dir, 'scp'),
    `#!/usr/bin/env bash
printf 'scp %s\\n' "$*" >> "$STUB_LOG"
if [[ "$*" == *out-*.tar* ]]; then
  [ -n "$FAKE_OUT_TAR" ] || exit 1
  cp "$FAKE_OUT_TAR" "\${@: -1}"
fi
`,
  );
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
    fetch: [],
    env: [],
    forward: [],
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

test('exits with NO_VERDICT_EXIT when the suite never reported an exit code', () => {
  const wsl = run(['--host', 'rack', '--log', '$LOG', '--', 'yarn test'], {
    FAKE_SUITE_CODE: '127',
    FAKE_NO_VERDICT: '1',
  });
  assert.equal(wsl.status, NO_VERDICT_EXIT);
  assert.match(wsl.stderr, /the suite reported no exit code \(exit 127\), no verdict/);

  const dropped = run(['--host', 'mac', '--', 'yarn test'], { FAKE_INIT_CODE: '255' });
  assert.equal(dropped.status, NO_VERDICT_EXIT);
  assert.match(dropped.stderr, /mirror init failed \(exit 255\)/);

  assert.equal(run(['--host', 'rack', '--', 'yarn test'], { FAKE_SUITE_CODE: '127' }).status, 127);
});

test('sends no bundle when the commit is an ancestor of a ref the remote mirror has', () => {
  const reached = run(['--host', 'rack', '--', 'yarn test'], { FAKE_HAVE: 'b'.repeat(40), FAKE_ANCESTOR: '1' });
  assert.equal(reached.status, 0);
  assert.match(reached.calls, /git rev-list --max-count=1 --stdin/);
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
    /MSYS_NO_PATHCONV=1 wsl\.exe -d ethlete --exec bash \/mnt\/c\/Users\/trbor\/ethlete-rr\/remote-guard\.sh 'w1' -- \\\n *bash \/mnt\/c\/Users\/trbor\/ethlete-rr\/rack-docker-run\.sh "\$sha" 'w1' -- 'yarn test'/,
  );
  assert.doesNotMatch(rack, /worktree add/);
});

test('exits 2 on bad arguments without calling ssh', () => {
  const result = run(['--host', 'nope', '--', 'true']);
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.calls, /trbor@/);
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
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), '24.17.0\n');
  writeFileSync(
    join(bin, 'node'),
    '#!/usr/bin/env bash\n[ "$1" = --version ] && { echo v24.17.0; exit 0; }\npwd > "$HOME/suite-cwd"\n',
  );
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

test('a native run starts no Nx daemon, which would outlive the run in the slot', () => {
  const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'echo "daemon=$NX_DAEMON"', host: 'mac', linux: false });
  const work = mkdtempSync(join(tmpdir(), 'remote-run-nx-daemon-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), '24.17.0\n');
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\necho v24.17.0\n');
  for (const name of ['git', 'yarn', 'node']) chmodSync(join(bin, name), 0o755);
  try {
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^daemon=false$/m);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('a mac run appends ~/.cargo/bin to PATH, a rack run leaves it out', () => {
  const mac = remoteScript({ sha: SHA, slot: 'w1', suite: 'x', host: 'mac', linux: false });
  const rack = remoteScript({ sha: SHA, slot: 'w1', suite: 'x', host: 'rack', linux: false });

  assert.match(mac, /export PATH="\$HOME\/\.local\/node\/bin:\$HOME\/\.local\/bin:\$PATH:\$HOME\/\.cargo\/bin"/);
  assert.doesNotMatch(rack, /\.cargo/);
});

test('a native run refuses a node that is not the pinned version and cannot be replaced', () => {
  const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'node --test a.spec.mjs', host: 'mac', linux: false });
  const work = mkdtempSync(join(tmpdir(), 'remote-run-node-pin-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), '24.17.0\n');
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\ntouch "$HOME/yarn-ran"\n');
  writeFileSync(join(bin, 'npm'), '#!/usr/bin/env bash\nexit 1\n');
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\necho v26.13.0\n');
  for (const name of ['git', 'yarn', 'npm', 'node']) chmodSync(join(bin, name), 0o755);
  try {
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot install node 24\.17\.0/);
    assert.equal(existsSync(join(home, 'yarn-ran')), false);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('a native run uses the pinned node of an earlier run without reinstalling it', () => {
  const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'node -v', host: 'mac', linux: false });
  const work = mkdtempSync(join(tmpdir(), 'remote-run-node-kept-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  const pinned = join(home, '.local', 'node-pin', 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  mkdirSync(pinned, { recursive: true });
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), '24.17.0\n');
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'npm'), '#!/usr/bin/env bash\ntouch "$HOME/npm-ran"\n');
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\necho v24.21.0\n');
  writeFileSync(join(pinned, 'node'), '#!/usr/bin/env bash\necho v24.17.0\n');
  for (const file of ['git', 'yarn', 'npm', 'node'].map((name) => join(bin, name)).concat(join(pinned, 'node'))) {
    chmodSync(file, 0o755);
  }
  try {
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^v24\.17\.0$/m);
    assert.equal(existsSync(join(home, 'npm-ran')), false);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('a native run keeps the yarn install state of the slot, so an unchanged install skips the link step', () => {
  const work = mkdtempSync(join(tmpdir(), 'remote-run-install-state-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  const slot = join(home, 'ethlete-rr', 'w1');
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(join(slot, '.yarn'), { recursive: true });
  mkdirSync(bin);
  const env = gitEnv({
    HOME: home,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  });
  const gitIn = (...args) => spawnSync('git', ['-C', slot, ...args], { encoding: 'utf8', env });
  writeFileSync(join(slot, '.gitignore'), '.yarn/*\n');
  writeFileSync(join(slot, '.node-version'), '24.17.0\n');
  gitIn('init', '--quiet');
  gitIn('add', '.');
  gitIn('commit', '--quiet', '-m', 'init');
  const sha = gitIn('rev-parse', 'HEAD').stdout.trim();
  writeFileSync(join(slot, '.yarn', 'install-state.gz'), 'state');
  writeFileSync(join(slot, '.yarn', 'stale.log'), 'stale');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\necho v24.17.0\n');
  for (const name of ['yarn', 'node']) chmodSync(join(bin, name), 0o755);
  try {
    const result = spawnSync(
      'bash',
      ['-c', remoteScript({ sha, slot: 'w1', suite: 'true', host: 'mac', linux: false })],
      {
        encoding: 'utf8',
        env: { ...env, PATH: `${bin}:${process.env.PATH}` },
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(existsSync(join(slot, '.yarn', 'stale.log')), false);
    assert.equal(readFileSync(join(slot, '.yarn', 'install-state.gz'), 'utf8'), 'state');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the git calls that pick the bundle do not grow with the refs the remote mirror has', () => {
  const haves = Array.from({ length: 300 }, (_, i) => i.toString(16).padStart(40, 'b')).join(' ');
  const result = run(['--host', 'rack', '--', 'yarn test'], { FAKE_HAVE: haves });
  assert.equal(result.status, 0);
  assert.ok(result.calls.split('\ngit ').length < 20, result.calls);
  assert.equal(result.calls.match(/^git bundle create .*$/m)?.[0].split(' ^').length, 301);
});

test('the rack helper keeps the yarn install state of the slot', () => {
  const helper = readFileSync(join(dirname(SCRIPT), 'rack-docker-run.sh'), 'utf8');
  assert.match(helper, /git -C "\$work" clean [^\n]*-e \.yarn\/install-state\.gz/);
});

test('the Linux container and the rack helper pin node to .node-version before the install', () => {
  const container = remoteScript({ sha: SHA, slot: 'w1', suite: 'true', host: 'mac', linux: true });
  assert.ok(
    container.indexOf('.node-version') > 0 && container.indexOf('.node-version') < container.indexOf('yarn install'),
  );
  const helper = readFileSync(join(dirname(SCRIPT), 'rack-docker-run.sh'), 'utf8');
  assert.ok(helper.indexOf('.node-version') > 0 && helper.indexOf('.node-version') < helper.indexOf('yarn install'));
});

test('the rack helper holds a per-slot lock before it touches the slot checkout', () => {
  const helper = readFileSync(join(dirname(SCRIPT), 'rack-docker-run.sh'), 'utf8');
  const lock = helper.indexOf('flock 9');
  assert.ok(lock > 0, 'no flock');
  assert.ok(helper.indexOf('$slot.lock') < lock);
  assert.ok(lock < helper.indexOf('checkout --quiet --force'));
});

test('--fetch is repeatable and refuses paths outside the repo', () => {
  const opts = parseArgs(['--host', 'rack', '--fetch', 'a/b.txt', '--fetch', 'c', '--', 'true']);
  assert.deepEqual(opts.fetch, ['a/b.txt', 'c']);
  assert.throws(() => parseArgs(['--host', 'rack', '--fetch', '../x', '--', 'true']), /inside the repo/);
  assert.throws(() => parseArgs(['--host', 'rack', '--fetch', '/etc/passwd', '--', 'true']), /inside the repo/);
  assert.throws(() => parseArgs(['--host', 'rack', '--fetch']), /incomplete option --fetch/);
});

test('the pack step differs per host and runs after the suite', () => {
  const base = { sha: SHA, slot: 'w1', suite: 'yarn test', fetch: ['out/a b.txt'], runId: 'r1' };
  const native = remoteScript({ ...base, host: 'mac', linux: false });
  assert.match(
    native,
    /suite exit \$code[^\n]*\n {2}rr_fetch "\$work" "\$HOME\/ethlete-rr\/out-r1\.tar" 'out\/a b\.txt'\n {2}return \$code/,
  );

  const mac = remoteScript({ ...base, host: 'mac', linux: true });
  assert.match(
    mac,
    /exit \$code`?\)?[^\n]*\n {2}local code=\$\?\n {2}rr_fetch "\$work" "\$HOME\/ethlete-rr\/out-r1\.tar"/,
  );

  const rack = remoteScript({ ...base, host: 'rack', linux: true, rackHelper: 'echo helper\n' });
  assert.match(
    rack,
    /local code=\$\?\n {2}MSYS_NO_PATHCONV=1 wsl\.exe -d ethlete --exec bash -c '[^']*rr_fetch "\$HOME\/rack-linux\/w1" "\/mnt\/c\/Users\/trbor\/ethlete-rr\/out-r1\.tar" "\$@"' _ 'out\/a b\.txt'\n {2}return \$code/,
  );
  assert.doesNotMatch(remoteScript({ ...base, fetch: [], host: 'mac', linux: false }), /rr_fetch "/);
});

test('rr_fetch packs the paths that exist, reports the missing ones and is not fatal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-fetch-'));
  try {
    mkdirSync(join(dir, 'work', 'out'), { recursive: true });
    writeFileSync(join(dir, 'work', 'out', 'x.txt'), 'hi');
    const guard = join(dirname(SCRIPT), 'remote-guard.sh');
    const result = spawnSync(
      'bash',
      ['-c', `. ${guard}; rr_fetch ${dir}/work ${dir}/o.tar out/x.txt nope.txt; echo rc=$?`],
      { encoding: 'utf8' },
    );
    assert.match(result.stdout, /fetch: missing nope\.txt/);
    assert.match(result.stdout, /packed out\/x\.txt/);
    assert.match(result.stdout, /rc=0/);
    const listed = spawnSync('tar', ['-tf', join(dir, 'o.tar')], { encoding: 'utf8' }).stdout;
    assert.match(listed, /out\/x\.txt/);
    assert.doesNotMatch(listed, /nope/);

    const none = spawnSync('bash', ['-c', `. ${guard}; rr_fetch ${dir}/work ${dir}/n.tar nope; echo rc=$?`], {
      encoding: 'utf8',
    });
    assert.match(none.stdout, /rc=0/);
    assert.equal(spawnSync('test', ['-e', join(dir, 'n.tar')]).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a native suite that fails still packs its outputs and keeps its exit code', () => {
  const script = remoteScript({
    sha: SHA,
    slot: 'w1',
    suite: 'mkdir -p out; echo shot > out/fail.png; false',
    host: 'mac',
    linux: false,
    fetch: ['out/fail.png'],
    runId: 'r2',
  });
  const work = mkdtempSync(join(tmpdir(), 'remote-run-native-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), process.version);
  for (const name of ['git', 'yarn']) chmodSync(join(bin, name), 0o755);
  try {
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const listed = spawnSync('tar', ['-tf', join(home, 'ethlete-rr', 'out-r2.tar')], { encoding: 'utf8' }).stdout;
    assert.match(listed, /out\/fail\.png/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('fetch unpacks the returned tar into the repo top, also after a failing suite, and removes the remote tar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-top-'));
  try {
    mkdirSync(join(dir, 'src', 'out'), { recursive: true });
    writeFileSync(join(dir, 'src', 'out', 'f.txt'), 'back');
    spawnSync('tar', ['-C', join(dir, 'src'), '-cf', join(dir, 'o.tar'), 'out/f.txt']);
    mkdirSync(join(dir, 'top'));
    const failed = run(['--host', 'rack', '--fetch', 'out/f.txt', '--', 'yarn e2e'], {
      FAKE_SUITE_CODE: '7',
      FAKE_TOP: join(dir, 'top'),
      FAKE_OUT_TAR: join(dir, 'o.tar'),
    });
    assert.equal(failed.status, 7);
    assert.match(failed.calls, /scp -q (-o \S+ )+trbor@192\.168\.1\.115:ethlete-rr\/out-\S+\.tar /);
    assert.equal(readFileSync(join(dir, 'top', 'out', 'f.txt'), 'utf8'), 'back');
    assert.match(failed.stderr, /fetch: unpacked into/);

    const empty = run(['--host', 'rack', '--fetch', 'out/f.txt', '--', 'yarn e2e'], { FAKE_TOP: join(dir, 'top') });
    assert.equal(empty.status, 0);
    assert.match(empty.stderr, /fetch: nothing came back/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--env and --forward are repeatable and refuse bad names and ports', () => {
  const opts = parseArgs(['--host', 'rack', '--env', 'A_TOKEN', '--env', 'B', '--forward', '8000', '--', 'true']);
  assert.deepEqual(opts.env, ['A_TOKEN', 'B']);
  assert.deepEqual(
    parseArgs(['--host', 'rack', '--forward', '80', '--forward', '8000', '--', 'x']).forward,
    [80, 8000],
  );
  assert.throws(() => parseArgs(['--host', 'rack', '--env', 'A-B', '--', 'true']), /--env needs a variable name/);
  assert.throws(() => parseArgs(['--host', 'rack', '--forward', '0', '--', 'true']), /--forward needs a port/);
  assert.throws(() => parseArgs(['--host', 'rack', '--forward', 'x', '--', 'true']), /--forward needs a port/);
});

test('an --env name that is unset here exits 2 before ssh', () => {
  const result = run(['--host', 'rack', '--env', 'RR_SPEC_UNSET_VAR', '--', 'true']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--env RR_SPEC_UNSET_VAR is not set here/);
  assert.doesNotMatch(result.calls, /trbor@/);
});

test('--env values go into the ssh script, and only the names into the container argv', () => {
  const base = { sha: SHA, slot: 'w1', suite: 'yarn test', env: [['NPM_TOKEN', "s3'cret"]] };
  const native = remoteScript({ ...base, host: 'mac', linux: false });
  assert.match(native, /export NPM_TOKEN='s3'\\''cret'/);

  const mac = remoteScript({ ...base, host: 'mac', linux: true });
  assert.match(mac, /-e NX_DAEMON=false -e NPM_TOKEN \\/);
  assert.equal(mac.split('s3').length, 2);

  const rack = remoteScript({ ...base, host: 'rack', linux: true, rackHelper: 'echo helper\n' });
  assert.match(rack, /export RR_ENV='NPM_TOKEN'/);
  assert.match(rack, /export WSLENV="NPM_TOKEN\/u:RR_ENV\/u\$\{WSLENV:\+:\$WSLENV\}"/);
  assert.equal(rack.split('s3').length, 2);

  const helper = readFileSync(join(dirname(SCRIPT), 'rack-docker-run.sh'), 'utf8');
  assert.match(helper, /for name in \$\{RR_ENV:-\}; do env_args\+=\(-e "\$name"\); done/);
  assert.match(helper, /docker run [^\n]*"\$\{env_args\[@\]\}"/);
});

test('--forward lets the suite reach a server of the caller through 127.0.0.1', async () => {
  const { createServer } = await import('node:net');
  const server = createServer((socket) => socket.end('from-caller'));
  await new Promise((resolve) => server.listen(0, '127.0.0.2', resolve));
  const { port } = server.address();
  const work = mkdtempSync(join(tmpdir(), 'remote-run-forward-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), process.version);
  for (const name of ['git', 'yarn']) chmodSync(join(bin, name), 0o755);
  const script = remoteScript({
    sha: SHA,
    slot: 'w1',
    suite: `node -e "require('net').connect(${port}, '127.0.0.1').on('data', (d) => require('fs').writeFileSync(process.env.HOME + '/got', d))"; exit 4`,
    host: 'mac',
    linux: false,
    forward: [port],
    caller: '127.0.0.2',
  });
  try {
    const { spawn } = await import('node:child_process');
    const child = spawn('bash', ['-c', script], {
      env: { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home },
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    const code = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(code, 4, output);
    assert.equal(readFileSync(join(home, 'got'), 'utf8'), 'from-caller');
    assert.doesNotMatch(output, /did not start/);
  } finally {
    server.close();
    rmSync(work, { recursive: true, force: true });
  }
});

test('--yarn-cache is a rack Linux option and picks the cache files the lockfile needs that exist here', () => {
  assert.equal(parseArgs(['--host', 'rack', '--linux', '--yarn-cache', '--', 'true']).yarnCache, true);
  assert.throws(
    () => parseArgs(['--host', 'mac', '--linux', '--yarn-cache', '--', 'true']),
    /rack Linux container only/,
  );
  assert.throws(() => parseArgs(['--host', 'rack', '--yarn-cache', '--', 'true']), /rack Linux container only/);
  const info = [
    { value: 'a@npm:1', children: { Cache: { Path: '/c/a-npm-1-x-10c0.zip' } } },
    { value: 'root@workspace:.', children: { Version: '0.0.0' } },
    { value: 'b@ssh:x', children: { Cache: { Path: '/c/b-ssh-y-10c0.zip' } } },
  ]
    .map((line) => JSON.stringify(line))
    .join('\n');
  assert.deepEqual(
    neededCacheFiles(`${info}\n`, (path) => path !== '/c/b-ssh-y-10c0.zip'),
    ['/c/a-npm-1-x-10c0.zip'],
  );
});

test('lfsFiles reads oid and path of git lfs ls-files --long, also a path with spaces', () => {
  const a = 'a'.repeat(64);
  const b = 'b1'.repeat(32);
  assert.deepEqual(lfsFiles(`${a} * fonts/x.ttf\n${b} - img/a b.png\nnoise\n`, '/r/.git/lfs/objects'), [
    { oid: a, path: 'fonts/x.ttf', file: `/r/.git/lfs/objects/aa/aa/${a}` },
    { oid: b, path: 'img/a b.png', file: `/r/.git/lfs/objects/b1/b1/${b}` },
  ]);
});

test('rr_lfs replaces the pointer files whose object is in the store and leaves the others', () => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-lfs-'));
  try {
    mkdirSync(join(dir, 'work', 'img'), { recursive: true });
    mkdirSync(join(dir, 'store'));
    writeFileSync(join(dir, 'work', 'img', 'a b.png'), 'pointer');
    writeFileSync(join(dir, 'work', 'img', 'c.png'), 'pointer');
    writeFileSync(join(dir, 'store', 'o1'), 'real');
    writeFileSync(join(dir, 'list'), 'o1 img/a b.png\no2 img/c.png\n');
    const guard = join(dirname(SCRIPT), 'remote-guard.sh');
    const result = spawnSync('bash', ['-c', `. ${guard}; rr_lfs ${dir}/work ${dir}/store ${dir}/list`], {
      encoding: 'utf8',
    });
    assert.match(result.stdout, /lfs: 1 files/);
    assert.equal(readFileSync(join(dir, 'work', 'img', 'a b.png'), 'utf8'), 'real');
    assert.equal(readFileSync(join(dir, 'work', 'img', 'c.png'), 'utf8'), 'pointer');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the remote script stores the lfs list of the commit and fills the checkout from it after the checkout', () => {
  const lfsList = `${'c'.repeat(64)} fonts/x.ttf\n`;
  const native = remoteScript({ sha: SHA, slot: 'w1', suite: 'true', host: 'mac', lfsList, guard: '' });
  assert.match(native, new RegExp(`lfs-lists/\\$sha" <<'REMOTE_RUN_LFS'\\n${lfsList}REMOTE_RUN_LFS`));
  assert.ok(native.indexOf('rr_lfs "$work"') > native.indexOf('worktree add'));
  assert.doesNotMatch(remoteScript({ sha: SHA, slot: 'w1', suite: 'true', host: 'mac', guard: '' }), /REMOTE_RUN_LFS/);

  const helper = readFileSync(join(dirname(SCRIPT), 'rack-docker-run.sh'), 'utf8');
  const rack = remoteScript({
    sha: SHA,
    slot: 'w1',
    suite: 'true',
    host: 'rack',
    linux: true,
    rackHelper: helper,
    lfsList,
    guard: '',
  });
  assert.match(rack, /REMOTE_RUN_LFS/);
  assert.ok(helper.indexOf('rr_lfs "$work"') > helper.indexOf('checkout --quiet --force'));
});

test('a native run takes the slot lock before it touches the slot checkout', () => {
  for (const host of ['rack', 'mac']) {
    const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'true', host, linux: false, guard: '' });
    assert.match(script, /rr_guard 'w1' checkout_and_run/);
    assert.match(
      script.slice(0, script.indexOf('main() {')),
      /checkout_and_run\(\) \{[\s\S]*worktree add[\s\S]*suite_run\n\}/,
    );
    assert.doesNotMatch(script.slice(script.indexOf('main() {')), /worktree add|checkout --quiet/);
  }
});

test('a native run on Windows finds the pinned node.exe that npm installs under node_modules', () => {
  const script = remoteScript({ sha: SHA, slot: 'w1', suite: 'node -v', host: 'rack', linux: false });
  const work = mkdtempSync(join(tmpdir(), 'remote-run-node-exe-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, 'ethlete-rr', 'w1', '.git'), { recursive: true });
  mkdirSync(join(home, 'ethlete-mirror.git'), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(home, 'ethlete-rr', 'w1', '.node-version'), '24.17.0\n');
  const exeDir = join(home, '.local', 'node-pin', 'node_modules', 'node', 'bin');
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'yarn'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(bin, 'node'), '#!/usr/bin/env bash\necho v24.19.0\n');
  writeFileSync(
    join(bin, 'npm'),
    `#!/usr/bin/env bash\nmkdir -p ${exeDir}\necho 'text placeholder' > ${exeDir}/node\nprintf '#!/bin/sh\\necho v24.17.0\\n' > ${exeDir}/node.exe\nchmod +x ${exeDir}/node.exe\n`,
  );
  for (const name of ['git', 'yarn', 'npm', 'node']) chmodSync(join(bin, name), 0o755);
  try {
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home },
    });
    assert.doesNotMatch(result.stdout + result.stderr, /not the pinned/);
    assert.match(result.stdout, /^v24\.17\.0$/m);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the init script sweeps the bundles and tars a killed caller left on the host', () => {
  const script = initScript();
  assert.match(script, /find "\$HOME" -maxdepth 1 -name 'ethlete-rr-\*\.bundle' -mmin \+60 -delete/);
  assert.match(script, /find "\$HOME\/ethlete-rr" .*'yarn-\*\.tar'.*'lfs-\*\.tar'.*'out-\*\.tar'.* -mmin \+60 -delete/);
});
