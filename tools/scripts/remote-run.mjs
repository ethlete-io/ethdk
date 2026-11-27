import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { killWithParent } from './kill-with-parent.mjs';
import { registerRun } from './run-registry.mjs';

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
const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'remote-guard.sh');

const PICTURE_SUITE = /--project[= ]visual\b|\bvisual\b|screenshot|golden|baseline|--update-snapshots/i;

const USAGE =
  'usage: remote-run.mjs --host rack|mac [--linux] [--ref <sha>] [--slot <name>] [--log <file>] [--fetch <path>]...' +
  ' [--env <name>]... [--forward <port>]... [--yarn-cache] -- <suite command>';

export const parseArgs = (argv) => {
  const split = argv.indexOf('--');
  const own = split === -1 ? argv : argv.slice(0, split);
  const suite = split === -1 ? '' : argv.slice(split + 1).join(' ');
  const opts = { host: undefined, ref: 'HEAD', slot: 'w1', log: undefined, fetch: [], env: [], forward: [], suite };

  for (let i = 0; i < own.length; i++) {
    if (own[i] === '--linux' || own[i] === '--yarn-cache') {
      opts[own[i] === '--linux' ? 'linux' : 'yarnCache'] = true;
      continue;
    }
    const key = own[i].replace(/^--/, '');
    if (!['host', 'ref', 'slot', 'log', 'fetch', 'env', 'forward'].includes(key) || own[i + 1] === undefined) {
      throw new Error(`unknown or incomplete option ${own[i]}\n${USAGE}`);
    }
    if (key === 'fetch') {
      const path = own[++i];
      if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes('..')) {
        throw new Error(`--fetch needs a path inside the repo, got ${path}`);
      }
      opts.fetch.push(path);
      continue;
    }
    if (key === 'env') {
      const name = own[++i];
      if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error(`--env needs a variable name, got ${name}`);
      opts.env.push(name);
      continue;
    }
    if (key === 'forward') {
      const port = Number(own[++i]);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`--forward needs a port, got ${own[i]}`);
      opts.forward.push(port);
      continue;
    }
    opts[key] = own[++i];
  }

  if (!HOSTS[opts.host]) throw new Error(`--host must be one of ${Object.keys(HOSTS).join(', ')}\n${USAGE}`);
  if (!opts.suite.trim()) throw new Error(`missing suite command after --\n${USAGE}`);
  if (!opts.linux && PICTURE_SUITE.test(opts.suite)) {
    throw new Error(`picture-comparing suites need Linux baselines: add --linux or run them on tank`);
  }
  if (!/^[\w.-]+$/.test(opts.slot)) throw new Error(`--slot must match [\\w.-]+`);
  if (opts.yarnCache && !(opts.linux && opts.host === 'rack')) {
    throw new Error('--yarn-cache seeds the rack Linux container only: use it with --host rack --linux');
  }
  return opts;
};

const shellQuote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;

const fetchArgs = (fetch) => fetch.map(shellQuote).join(' ');

const FORWARD_PROXY =
  'const n=require(`net`),[ps,h]=process.argv.slice(1),q=ps.split(`,`);let w=0;for(const p of q)n.createServer(c=>{' +
  'const u=n.connect(+p,h);c.pipe(u).pipe(c);u.on(`error`,()=>c.destroy());c.on(`error`,()=>u.destroy())' +
  '}).listen(+p,`127.0.0.1`,()=>++w===q.length&&console.log(`ready`))';

/**
 * The suite behind a TCP proxy from 127.0.0.1:<port> on the remote side to the same port on the caller, so the suite
 * reaches a server that runs only on the calling machine. One line: the rack passes it through wsl.exe argv.
 */
export const withForward = (suite, ports, caller) =>
  ports.length
    ? `exec {rr_fd}< <(node -e ${shellQuote(FORWARD_PROXY)} ${ports.join(',')} ${shellQuote(caller)}); rr_fwd=$!; ` +
      `read -r -u $rr_fd _ || echo '[remote-run] --forward did not start' >&2; (${suite})` +
      `; rr_code=$?; kill $rr_fwd 2>/dev/null; (exit $rr_code)`
    : suite;

// The values travel in the ssh script on stdin, never in an argv the remote process list shows.
const envExports = (env, rackLinux) =>
  [
    ...env.map(([name, value]) => `export ${name}=${shellQuote(value)}`),
    ...(rackLinux && env.length
      ? [
          `export RR_ENV=${shellQuote(env.map(([name]) => name).join(' '))}`,
          `export WSLENV="${[...env.map(([name]) => `${name}/u`), 'RR_ENV/u'].join(':')}\${WSLENV:+:$WSLENV}"`,
        ]
      : []),
  ].join('\n  ') || ':';

const outTar = (runId) => `ethlete-rr/out-${runId}.tar`;

export const nodePin = (prefix, fail) => `pin=$(tr -d 'v \\r\\n' < .node-version) || ${fail}
[ "$(node --version 2>/dev/null)" = "v$pin" ] || npm install --global --silent --prefix ${prefix} node@$pin >/dev/null || { echo "[remote-run] cannot install node $pin" >&2; ${fail}; }
export PATH=${prefix}/bin:$PATH
[ "$(node --version)" = "v$pin" ] || { echo "[remote-run] node $(node --version) is not the pinned v$pin" >&2; ${fail}; }`;

const nativeRun = (
  suite,
  fetch,
  runId,
) => `  export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NX_NO_CLOUD=true
  cd "$work" || return 1
  ${nodePin('"$HOME/.local/node-pin"', 'return 1')}
  local started=$SECONDS
  yarn install --immutable > "$work/.remote-run-install.log" 2>&1 || { tail -40 "$work/.remote-run-install.log"; return 1; }
  echo "[remote-run] install $((SECONDS - started))s"
  started=$SECONDS
  eval ${shellQuote(suite)}
  local code=$?
  echo "[remote-run] suite exit $code after $((SECONDS - started))s"${
    fetch.length ? `\n  rr_fetch "$work" "$HOME/${outTar(runId)}" ${fetchArgs(fetch)}` : ''
  }
  return $code`;

const containerSetup = `[ -x /opt/tools/bin/corepack ] || npm install --global --silent --prefix /opt/tools corepack >/dev/null
export PATH=/opt/tools/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable --install-directory /opt/tools/bin
${nodePin('/opt/tools', 'exit 1')}
started=$SECONDS
yarn install --immutable >/tmp/yarn-install.log 2>&1 || { tail -40 /tmp/yarn-install.log; exit 1; }
echo "[remote-run] install $((SECONDS - started))s"
started=$SECONDS
`;

const linuxRun = (suite, slot, fetch, runId, env) => `  export PATH="/usr/local/bin:$PATH"
  docker image inspect ${LINUX_IMAGE} >/dev/null 2>&1 || docker pull --quiet ${LINUX_IMAGE} || return 1
  docker run --rm --init --ipc=host -v "$work:$work" -w "$work" -v "$mirror:$mirror" \\
    -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0="*" \\
    -v ethlete-rr-yarn-${slot}:/root/.yarn/berry -v ethlete-rr-tools:/opt/tools --label ethlete-rr-slot=${slot} \\
    -e CI=1 -e NX_NO_CLOUD=true -e NX_DAEMON=false ${env.map(([name]) => `-e ${name} `).join('')}\\
    ${LINUX_IMAGE} bash -c ${shellQuote(`${containerSetup}${suite}
code=$?
echo "[remote-run] suite exit $code after $((SECONDS - started))s"
exit $code`)}
  local code=$?${fetch.length ? `\n  rr_fetch "$work" "$HOME/${outTar(runId)}" ${fetchArgs(fetch)}` : ''}
  return $code`;

const rackLinuxRun = (
  suite,
  slot,
  helper,
  fetch,
  runId,
) => `  cat > "$HOME/ethlete-rr/rack-docker-run.sh" <<'REMOTE_RUN_HELPER'
${helper}REMOTE_RUN_HELPER
  MSYS_NO_PATHCONV=1 wsl.exe -d ethlete --exec bash /mnt/c/Users/trbor/ethlete-rr/remote-guard.sh ${shellQuote(slot)} -- \\
    bash /mnt/c/Users/trbor/ethlete-rr/rack-docker-run.sh "$sha" ${shellQuote(slot)} -- ${shellQuote(suite)}
  local code=$?${
    fetch.length
      ? `
  MSYS_NO_PATHCONV=1 wsl.exe -d ethlete --exec bash -c '. /mnt/c/Users/trbor/ethlete-rr/remote-guard.sh; rr_fetch "$HOME/rack-linux/${slot}" "/mnt/c/Users/trbor/${outTar(runId)}" "$@"' _ ${fetchArgs(fetch)}`
      : ''
  }
  return $code`;

export const remoteScript = ({
  sha,
  slot,
  suite,
  bundle,
  host,
  linux,
  rackHelper,
  fetch = [],
  runId = 'run',
  env = [],
  forward = [],
  caller,
  lfsList,
  guard = readFileSync(GUARD, 'utf8'),
}) => {
  const wrapped = withForward(suite, forward, caller);
  const rackLinux = linux && host === 'rack';
  const run = !linux
    ? nativeRun(wrapped, fetch, runId)
    : rackLinux
      ? rackLinuxRun(wrapped, slot, rackHelper, fetch, runId)
      : linuxRun(wrapped, slot, fetch, runId, env);
  return `suite_run() {
${run}
}
main() {
  local mirror="$HOME/ethlete-mirror.git" work="$HOME/ethlete-rr/${slot}${linux ? '-linux' : ''}" sha=${shellQuote(sha)}
  ${envExports(env, rackLinux)}
  ${
    bundle
      ? `git -C "$mirror" fetch --quiet --force "$HOME/${bundle}" "refs/remote-run/$sha:refs/heads/remote-run-$sha" || return 1
  rm -f "$HOME/${bundle}"`
      : ':'
  }
  mkdir -p "$HOME/ethlete-rr"
  cat > "$HOME/ethlete-rr/remote-guard.sh" <<'REMOTE_RUN_GUARD'
${guard}REMOTE_RUN_GUARD
  ${
    lfsList
      ? `mkdir -p "$HOME/ethlete-rr/lfs-lists"
  cat > "$HOME/ethlete-rr/lfs-lists/$sha" <<'REMOTE_RUN_LFS'
${lfsList}REMOTE_RUN_LFS`
      : ':'
  }
  ${
    !rackLinux
      ? `if [ -e "$work/.git" ]; then
    git -C "$work" checkout --quiet --force --detach "$sha" || return 1
    git -C "$work" clean -ffdxq -e node_modules -e .nx || return 1
  else
    git -C "$mirror" worktree prune
    git -C "$mirror" -c core.longpaths=true worktree add --quiet --detach "$work" "$sha" || return 1
  fi
  if [ -f "$HOME/ethlete-rr/lfs-lists/$sha" ]; then
    . "$HOME/ethlete-rr/remote-guard.sh"
    rr_lfs "$work" "$HOME/ethlete-rr/lfs" "$HOME/ethlete-rr/lfs-lists/$sha"
  fi
  echo "[remote-run] $(hostname) $work at $(git -C "$work" rev-parse --short HEAD)"`
      : 'echo "[remote-run] $(hostname) WSL ethlete container run"'
  }
  ${
    rackLinux
      ? 'suite_run'
      : `. "$HOME/ethlete-rr/remote-guard.sh"
  rr_guard ${shellQuote(slot)} suite_run`
  }
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
  echo "client \${SSH_CLIENT%% *}"
}
main </dev/null
`;

const SSH_OPTIONS = ['-o', 'BatchMode=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=4'];

const withoutHeartbeat = (chunk) => (chunk.includes(0) ? chunk.filter((byte) => byte !== 0) : chunk);

const git = (args, options = {}) => spawnSync('git', args, { encoding: 'utf8', ...options });

const runSsh = (host, script, { onData } = {}) =>
  new Promise((resolve) => {
    const watch = killWithParent();
    const child = spawn('ssh', [...SSH_OPTIONS, host.ssh, host.shell], { stdio: ['pipe', 'pipe', 'pipe'] });
    watch(child);
    child.stdout.on('data', (chunk) => onData?.(withoutHeartbeat(chunk), process.stdout));
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
  const unset = (opts.env ?? []).filter((name) => process.env[name] === undefined);
  if (unset.length) {
    process.stderr.write(`[remote-run] --env ${unset.join(', ')} is not set here\n`);
    return 2;
  }
  const log = opts.log ?? join(tmpdir(), 'remote-run', `${opts.host}-${sha.slice(0, 12)}-${Date.now()}.log`);
  mkdirSync(dirname(log), { recursive: true });
  const file = createWriteStream(log);
  const entry = process.env['REMOTE_RUN_NO_REGISTRY']
    ? { finish: () => undefined }
    : registerRun({ machine: opts.host, label: `remote-run ${opts.suite}`, command: opts.suite, log });
  const end = (code, reason) => {
    entry.finish(code);
    return finish(file, code, reason);
  };
  const tee = (chunk, stream) => {
    stream.write(chunk);
    file.write(chunk);
  };

  tee(`[remote-run] ${opts.host} ${sha} slot ${opts.slot}, log ${log}\n`, process.stdout);
  let haves = '';
  const init = await runSsh(host, initScript(), {
    onData: (chunk, stream) => (stream === process.stdout ? (haves += chunk) : tee(chunk, stream)),
  });
  if (init !== 0) return end(init, 'mirror init failed');

  const caller = haves.match(/^client (\S+)\s*$/m)?.[1];
  if (opts.forward?.length && !caller) return end(1, '--forward: the remote side does not report the caller address');
  const known = [...haves.matchAll(/^have ([0-9a-f]{40})\s*$/gm)].map((m) => m[1]);
  const reachable = known.some((have) => have === sha || git(['merge-base', '--is-ancestor', sha, have]).status === 0);
  let bundle;
  if (!reachable) {
    const bases = known.filter((have) => git(['cat-file', '-e', `${have}^{commit}`]).status === 0);
    bundle = `ethlete-rr-${sha.slice(0, 12)}.bundle`;
    const local = join(dirname(log), bundle);
    const ref = `refs/remote-run/${sha}`;
    git(['update-ref', ref, sha]);
    const created = git(['bundle', 'create', '--quiet', local, ref, ...bases.map((have) => `^${have}`)]);
    git(['update-ref', '-d', ref]);
    if (created.status !== 0) return end(1, `bundle failed: ${created.stderr.trim()}`);
    const copy = spawnSync('scp', ['-q', ...SSH_OPTIONS, local, `${host.ssh}:${bundle}`], { encoding: 'utf8' });
    rmSync(local, { force: true });
    if (copy.status !== 0) return end(copy.status ?? 1, `scp failed: ${copy.stderr.trim()}`);
  }

  const runId = `${Date.now().toString(36)}-${process.pid}`;
  if (opts.yarnCache) {
    const seeded = await seedYarnCache(host, opts.slot, runId, tee);
    if (seeded !== 0) return end(seeded, 'yarn cache seed failed');
  }
  const lfs = await seedLfs(host, sha, runId, tee);
  if (lfs.code !== 0) return end(lfs.code, 'lfs seed failed');
  const code = await runSsh(
    host,
    remoteScript({
      lfsList: lfs.list,
      fetch: opts.fetch,
      env: (opts.env ?? []).map((name) => [name, process.env[name]]),
      forward: opts.forward ?? [],
      caller,
      runId,
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
  if (opts.fetch?.length) await fetchOutputs(host, runId, tee);
  return end(code);
};

/** The yarn cache files the repo's lockfile needs, from `yarn info -A -R --cache --json` output, that exist here. */
export const neededCacheFiles = (infoJson, exists = existsSync) =>
  infoJson
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line).children?.Cache?.Path)
    .filter((path) => path && exists(path));

const RACK_YARN_CACHE = (slot) => `$HOME/rack-linux/.cache/yarn-${slot}/cache`;

const wslScript = (body, ...args) =>
  `MSYS_NO_PATHCONV=1 wsl.exe -d ethlete --exec bash -c ${shellQuote(body)} _ ${args.map(shellQuote).join(' ')} </dev/null\n`;

/**
 * Copies the yarn cache files of this repo that the rack slot's container cache lacks, so `yarn install` there
 * needs no access to private git hosts or registries that only this machine can reach.
 */
const seedYarnCache = async (host, slot, runId, tee) => {
  const info = spawnSync('yarn', ['info', '-A', '-R', '--cache', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (info.status !== 0) {
    tee(`[remote-run] yarn-cache: yarn info failed: ${info.stderr.trim()}\n`, process.stderr);
    return 1;
  }
  const needed = neededCacheFiles(info.stdout);
  let listing = '';
  const listed = await runSsh(host, wslScript(`ls "${RACK_YARN_CACHE('$1')}" 2>/dev/null; exit 0`, slot), {
    onData: (chunk, stream) => (stream === process.stdout ? (listing += chunk) : tee(chunk, stream)),
  });
  if (listed !== 0) return listed;
  const have = new Set(listing.split(/\r?\n/));
  const missing = needed.filter((path) => !have.has(basename(path)));
  tee(`[remote-run] yarn-cache: ${needed.length} needed, ${missing.length} to copy\n`, process.stdout);
  if (!missing.length) return 0;
  const remoteTar = `ethlete-rr/yarn-${runId}.tar`;
  const sent = sendTar(
    host,
    ['-C', dirname(missing[0]), ...missing.map((p) => basename(p))],
    remoteTar,
    'yarn-cache',
    tee,
  );
  if (sent !== 0) return sent;
  return runSsh(
    host,
    wslScript(
      `mkdir -p "${RACK_YARN_CACHE('$1')}" && tar -C "${RACK_YARN_CACHE('$1')}" -xf "$2"; c=$?; rm -f "$2"; exit $c`,
      slot,
      `/mnt/c/Users/trbor/${remoteTar}`,
    ),
    { onData: tee },
  );
};

const sendTar = (host, tarArgs, remoteTar, label, tee) => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-tar-'));
  const tar = join(dir, 'send.tar');
  try {
    const packed = spawnSync('tar', ['-cf', tar, ...tarArgs], { encoding: 'utf8' });
    if (packed.status !== 0) {
      tee(`[remote-run] ${label}: tar failed: ${packed.stderr.trim()}\n`, process.stderr);
      return 1;
    }
    const copy = spawnSync('scp', ['-q', ...SSH_OPTIONS, tar, `${host.ssh}:${remoteTar}`], { encoding: 'utf8' });
    if (copy.status !== 0) {
      tee(`[remote-run] ${label}: scp failed: ${copy.stderr.trim()}\n`, process.stderr);
      return copy.status ?? 1;
    }
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** The Git LFS files of a commit from `git lfs ls-files --long <sha>` output, with their object file here. */
export const lfsFiles = (lsFiles, objectsDir) =>
  lsFiles
    .split('\n')
    .map((line) => line.match(/^([0-9a-f]{64}) [*-] (.+)$/))
    .filter(Boolean)
    .map(([, oid, path]) => ({ oid, path, file: join(objectsDir, oid.slice(0, 2), oid.slice(2, 4), oid) }));

/**
 * Copies the Git LFS objects of the commit that the remote store lacks and returns the "<oid> <path>" list the
 * remote side uses to replace the pointer files of its checkout; a git bundle carries no LFS objects.
 */
const seedLfs = async (host, sha, runId, tee) => {
  const listed = git(['lfs', 'ls-files', '--long', sha], { maxBuffer: 1 << 28 });
  if (listed.status !== 0 || !listed.stdout.trim()) return { code: 0 };
  const gitDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout.trim();
  const objectsDir = join(gitDir, 'lfs', 'objects');
  const files = lfsFiles(listed.stdout, objectsDir);
  const here = files.filter(({ file }) => existsSync(file));
  if (here.length < files.length) {
    tee(`[remote-run] lfs: ${files.length - here.length} objects are not fetched here\n`, process.stderr);
  }
  let listing = '';
  const ls = await runSsh(host, 'mkdir -p "$HOME/ethlete-rr/lfs" && ls "$HOME/ethlete-rr/lfs"\n', {
    onData: (chunk, stream) => (stream === process.stdout ? (listing += chunk) : tee(chunk, stream)),
  });
  if (ls !== 0) return { code: ls };
  const have = new Set(listing.split(/\r?\n/));
  const missing = [
    ...new Set(here.filter(({ oid }) => !have.has(oid)).map(({ file }) => file.slice(objectsDir.length + 1))),
  ];
  tee(`[remote-run] lfs: ${here.length} files, ${missing.length} objects to copy\n`, process.stdout);
  if (missing.length) {
    const dir = mkdtempSync(join(tmpdir(), 'remote-run-lfs-'));
    const names = join(dir, 'names');
    writeFileSync(names, `${missing.join('\n')}\n`);
    const remoteTar = `ethlete-rr/lfs-${runId}.tar`;
    try {
      const sent = sendTar(host, ['-C', objectsDir, '--transform', 's,.*/,,', '-T', names], remoteTar, 'lfs', tee);
      if (sent !== 0) return { code: sent };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const unpacked = await runSsh(
      host,
      `tar -C "$HOME/ethlete-rr/lfs" -xf "$HOME/${remoteTar}"; c=$?; rm -f "$HOME/${remoteTar}"; exit $c\n`,
      { onData: tee },
    );
    if (unpacked !== 0) return { code: unpacked };
  }
  return { code: 0, list: here.map(({ oid, path }) => `${oid} ${path}\n`).join('') };
};

const fetchOutputs = async (host, runId, tee) => {
  const dir = mkdtempSync(join(tmpdir(), 'remote-run-out-'));
  const local = join(dir, 'out.tar');
  const copy = spawnSync('scp', ['-q', ...SSH_OPTIONS, `${host.ssh}:${outTar(runId)}`, local], { encoding: 'utf8' });
  if (copy.status !== 0 || !existsSync(local)) {
    tee('[remote-run] fetch: nothing came back\n', process.stderr);
  } else {
    const top = git(['rev-parse', '--show-toplevel']).stdout.trim() || process.cwd();
    const unpacked = spawnSync('tar', ['-xf', local, '-C', top], { encoding: 'utf8' });
    tee(
      unpacked.status === 0
        ? `[remote-run] fetch: unpacked into ${top}\n`
        : `[remote-run] fetch: tar -x failed: ${unpacked.stderr.trim()}\n`,
      process.stderr,
    );
  }
  rmSync(dir, { recursive: true, force: true });
  await runSsh(host, `rm -f "$HOME/${outTar(runId)}"\n`);
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
