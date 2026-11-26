import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOSTS = {
  rack: {
    ssh: 'trbor@192.168.1.115',
    shell: '& "C:\\Program Files\\Git\\bin\\bash.exe" -l -s; exit $LASTEXITCODE',
  },
  mac: {
    ssh: 'ethlete-mac',
    shell: 'bash -l -s',
  },
};

export const LINUX_IMAGE =
  'mcr.microsoft.com/playwright@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f';

const RACK_HELPER = join(dirname(fileURLToPath(import.meta.url)), 'rack-docker-run.sh');

const PICTURE_SUITE = /--project[= ]visual\b|\bvisual\b|screenshot|golden|baseline|--update-snapshots/i;

const USAGE =
  'usage: remote-run.mjs --host rack|mac [--linux] [--ref <sha>] [--slot <name>] [--log <file>] -- <suite command>';

export const parseArgs = (argv) => {
  const split = argv.indexOf('--');
  const own = split === -1 ? argv : argv.slice(0, split);
  const suite = split === -1 ? '' : argv.slice(split + 1).join(' ');
  const opts = { host: undefined, ref: 'HEAD', slot: 'w1', log: undefined, suite };

  for (let i = 0; i < own.length; i++) {
    if (own[i] === '--linux') {
      opts.linux = true;
      continue;
    }
    const key = own[i].replace(/^--/, '');
    if (!['host', 'ref', 'slot', 'log'].includes(key) || own[i + 1] === undefined) {
      throw new Error(`unknown or incomplete option ${own[i]}\n${USAGE}`);
    }
    opts[key] = own[++i];
  }

  if (!HOSTS[opts.host]) throw new Error(`--host must be one of ${Object.keys(HOSTS).join(', ')}\n${USAGE}`);
  if (!opts.suite.trim()) throw new Error(`missing suite command after --\n${USAGE}`);
  if (!opts.linux && PICTURE_SUITE.test(opts.suite)) {
    throw new Error(`picture-comparing suites need Linux baselines: add --linux or run them on tank`);
  }
  if (!/^[\w.-]+$/.test(opts.slot)) throw new Error(`--slot must match [\\w.-]+`);
  return opts;
};

const shellQuote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;

const nativeRun = (suite) => `  export PATH="$HOME/.local/bin:$PATH" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NX_NO_CLOUD=true
  local started=$SECONDS
  yarn install --immutable > "$work/.remote-run-install.log" 2>&1 || { tail -40 "$work/.remote-run-install.log"; return 1; }
  echo "[remote-run] install $((SECONDS - started))s"
  started=$SECONDS
  eval ${shellQuote(suite)}
  local code=$?
  echo "[remote-run] suite exit $code after $((SECONDS - started))s"
  return $code`;

const containerSetup = `[ -x /opt/tools/bin/corepack ] || npm install --global --silent --prefix /opt/tools corepack >/dev/null
export PATH=/opt/tools/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable --install-directory /opt/tools/bin
started=$SECONDS
yarn install --immutable >/tmp/yarn-install.log 2>&1 || { tail -40 /tmp/yarn-install.log; exit 1; }
echo "[remote-run] install $((SECONDS - started))s"
started=$SECONDS
`;

const linuxRun = (suite, slot) => `  export PATH="/usr/local/bin:$PATH"
  docker image inspect ${LINUX_IMAGE} >/dev/null 2>&1 || docker pull --quiet ${LINUX_IMAGE} || return 1
  docker run --rm --init --ipc=host -v "$work:$work" -w "$work" -v "$mirror:$mirror" \\
    -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0="*" \\
    -v ethlete-rr-yarn-${slot}:/root/.yarn/berry -v ethlete-rr-tools:/opt/tools \\
    -e CI=1 -e NX_NO_CLOUD=true -e NX_DAEMON=false \\
    ${LINUX_IMAGE} bash -c ${shellQuote(`${containerSetup}${suite}
code=$?
echo "[remote-run] suite exit $code after $((SECONDS - started))s"
exit $code`)}`;

const rackLinuxRun = (suite, slot, helper) => `  cat > "$HOME/ethlete-rr/rack-docker-run.sh" <<'REMOTE_RUN_HELPER'
${helper}REMOTE_RUN_HELPER
  MSYS_NO_PATHCONV=1 wsl.exe -d ethlete -- bash /mnt/c/Users/trbor/ethlete-rr/rack-docker-run.sh "$sha" ${shellQuote(slot)} -- ${shellQuote(suite)}`;

export const remoteScript = ({ sha, slot, suite, bundle, host, linux, rackHelper }) => {
  const run = !linux
    ? nativeRun(suite)
    : host === 'rack'
      ? rackLinuxRun(suite, slot, rackHelper)
      : linuxRun(suite, slot);
  const checkout = !(linux && host === 'rack');
  return `main() {
  local mirror="$HOME/ethlete-mirror.git" work="$HOME/ethlete-rr/${slot}${linux ? '-linux' : ''}" sha=${shellQuote(sha)}
  ${
    bundle
      ? `git -C "$mirror" fetch --quiet --force "$HOME/${bundle}" "refs/remote-run/$sha:refs/heads/remote-run-$sha" || return 1
  rm -f "$HOME/${bundle}"`
      : ':'
  }
  mkdir -p "$HOME/ethlete-rr"
  ${
    checkout
      ? `if [ -e "$work/.git" ]; then
    git -C "$work" checkout --quiet --force --detach "$sha" || return 1
    git -C "$work" clean -ffdxq -e node_modules -e .nx || return 1
  else
    git -C "$mirror" worktree prune
    git -C "$mirror" -c core.longpaths=true worktree add --quiet --detach "$work" "$sha" || return 1
  fi
  echo "[remote-run] $(hostname) $work at $(git -C "$work" rev-parse --short HEAD)"`
      : 'echo "[remote-run] $(hostname) WSL ethlete container run"'
  }
${run}
}
main </dev/null
`;
};

export const initScript = () => `main() {
  local mirror="$HOME/ethlete-mirror.git"
  [ -d "$mirror" ] || git init --quiet --bare "$mirror" || return 1
  git -C "$mirror" config core.autocrlf false
  git -C "$mirror" config core.longpaths true
  git -C "$mirror" for-each-ref --format='have %(objectname)'
}
main </dev/null
`;

const SSH_OPTIONS = ['-o', 'BatchMode=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=4'];

const git = (args, options = {}) => spawnSync('git', args, { encoding: 'utf8', ...options });

const runSsh = (host, script, { onData } = {}) =>
  new Promise((resolve) => {
    const child = spawn('ssh', [...SSH_OPTIONS, host.ssh, host.shell], { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => onData?.(chunk, process.stdout));
    child.stderr.on('data', (chunk) => onData?.(chunk, process.stderr));
    child.on('error', (error) => {
      process.stderr.write(`[remote-run] ssh failed: ${error.message}\n`);
      resolve(255);
    });
    child.on('close', (code, signal) => resolve(code ?? (signal ? 255 : 1)));
    child.stdin.end(script);
  });

export const remoteRun = async (opts) => {
  const host = HOSTS[opts.host];
  const resolved = git(['rev-parse', '--verify', `${opts.ref}^{commit}`]);
  if (resolved.status !== 0) {
    process.stderr.write(`[remote-run] cannot resolve ${opts.ref}\n`);
    return 2;
  }
  const sha = resolved.stdout.trim();
  const log = opts.log ?? join(tmpdir(), 'remote-run', `${opts.host}-${sha.slice(0, 12)}-${Date.now()}.log`);
  mkdirSync(dirname(log), { recursive: true });
  const file = createWriteStream(log);
  const tee = (chunk, stream) => {
    stream.write(chunk);
    file.write(chunk);
  };

  tee(`[remote-run] ${opts.host} ${sha} slot ${opts.slot}, log ${log}\n`, process.stdout);
  let haves = '';
  const init = await runSsh(host, initScript(), {
    onData: (chunk, stream) => (stream === process.stdout ? (haves += chunk) : tee(chunk, stream)),
  });
  if (init !== 0) return finish(file, init, 'mirror init failed');

  const known = [...haves.matchAll(/^have ([0-9a-f]{40})\s*$/gm)].map((m) => m[1]);
  let bundle;
  if (!known.includes(sha)) {
    const bases = known.filter((have) => git(['cat-file', '-e', `${have}^{commit}`]).status === 0);
    bundle = `ethlete-rr-${sha.slice(0, 12)}.bundle`;
    const local = join(dirname(log), bundle);
    const ref = `refs/remote-run/${sha}`;
    git(['update-ref', ref, sha]);
    const created = git(['bundle', 'create', '--quiet', local, ref, ...bases.map((have) => `^${have}`)]);
    git(['update-ref', '-d', ref]);
    if (created.status !== 0) return finish(file, 1, `bundle failed: ${created.stderr.trim()}`);
    const copy = spawnSync('scp', ['-q', ...SSH_OPTIONS, local, `${host.ssh}:${bundle}`], { encoding: 'utf8' });
    rmSync(local, { force: true });
    if (copy.status !== 0) return finish(file, copy.status ?? 1, `scp failed: ${copy.stderr.trim()}`);
  }

  const code = await runSsh(
    host,
    remoteScript({
      sha,
      slot: opts.slot,
      suite: opts.suite,
      bundle,
      host: opts.host,
      linux: opts.linux,
      rackHelper: opts.linux && opts.host === 'rack' ? readFileSync(RACK_HELPER, 'utf8') : undefined,
    }),
    { onData: tee },
  );
  return finish(file, code);
};

const finish = (file, code, reason) =>
  new Promise((resolve) => {
    if (reason) file.write(`[remote-run] ${reason}\n`);
    file.end(() => resolve(code));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  process.exitCode = await remoteRun(opts);
}
