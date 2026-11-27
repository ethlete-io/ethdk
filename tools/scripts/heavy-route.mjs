import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { basename, dirname, relative, resolve } from 'node:path';
import { HOSTS } from './remote-run.mjs';

/** The machines heavy.mjs routes to, with their slot counts; `tank` is this PC. */
export const MACHINES = {
  tank: { slots: 3 },
  rack: { slots: 2, linux: true },
  mac: { slots: 1 },
};

// Slot 1 is the old lock file, so a bare `flock /tmp/fifagg-heavy.lock` caller counts as one holder.
export const slotFile = (machine, n, prefix = process.env.HEAVY_LOCK_PREFIX ?? '/tmp/fifagg-heavy') =>
  machine !== 'tank' ? `${prefix}.${machine}-${n}.lock` : n === 1 ? `${prefix}.lock` : `${prefix}.slot-${n}.lock`;

export const tankHasFreeSlot = (prefix = process.env.HEAVY_LOCK_PREFIX ?? '/tmp/fifagg-heavy') =>
  Array.from({ length: Number(process.env.HEAVY_SLOTS ?? MACHINES.tank.slots) }, (_, i) =>
    slotFile('tank', i + 1, prefix),
  ).some((file) => spawnSync('flock', ['-n', '-E', '200', file, 'true'], { stdio: 'ignore' }).status !== 200);

/** Whether tank has no free slot or a one-minute load above HEAVY_MAX_LOAD (default: its core count). */
export const tankIsLoaded = (env = process.env, prefix = env.HEAVY_LOCK_PREFIX ?? '/tmp/fifagg-heavy') =>
  loadavg()[0] > Number(env.HEAVY_MAX_LOAD || cpus().length) || !tankHasFreeSlot(prefix);

const WRITES_FILES = /^(--fix|--write|-u|--update|--update-snapshots)(=|$)/;
const PICTURE = /visual|screenshot|golden|baseline/i;
const WEBKIT = /webkit/i;
const NEEDS_CARGO = /\bstudio:e2e\b|ethlete-studio\/e2e\//;
const TANK_JOB = /\b(build|serve|storybook|e2e|playwright|tauri|cargo|affected|design|push-suite|release)\b/i;
const UNIT_JOB = /\b(lint|eslint|typecheck|tsc|vitest|jest|test|coverage)\b/i;
const SPEC_FILE = /\.(spec|test)\.[cm]?[jt]sx?$/;

/**
 * The machine a command runs on: visual jobs, builds, servers and anything that writes into the working tree stay on
 * tank, as does the Studio e2e (its design-host needs cargo, which only tank has); lint and unit tests go to rack; a
 * single spec file and WebKit go to mac. Unknown commands stay on tank.
 */
export const jobMachine = (command) => {
  const words = command.join(' ').split(/\s+/).filter(Boolean);
  const specFiles = words.filter((word) => SPEC_FILE.test(word.replace(/['"]/g, '')));
  const verbs = words.filter((word) => !word.includes('/') && !SPEC_FILE.test(word)).join(' ');
  if (words.some((word) => WRITES_FILES.test(word)) || PICTURE.test(verbs)) return 'tank';
  if (NEEDS_CARGO.test(command.join(' '))) return 'tank';
  if (WEBKIT.test(verbs)) return 'mac';
  if (TANK_JOB.test(verbs)) return 'tank';
  if (UNIT_JOB.test(verbs)) return specFiles.length === 1 ? 'mac' : 'rack';
  return 'tank';
};

const shellWord = (word) => (/^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`);

/** The command as one shell line for the remote side, run from the same directory relative to the repo root. */
export const remoteSuite = (command, rel) => {
  const line = command.length === 1 ? command[0] : command.map(shellWord).join(' ');
  return rel ? `cd ${shellWord(rel)} && ${line}` : line;
};

const SNAPSHOT_IDENTITY = {
  GIT_AUTHOR_NAME: 'heavy',
  GIT_AUTHOR_EMAIL: 'heavy@localhost',
  GIT_COMMITTER_NAME: 'heavy',
  GIT_COMMITTER_EMAIL: 'heavy@localhost',
};

/**
 * Commits the working tree of the repo around `cwd` (tracked and untracked, not ignored) through a private index, so
 * a remote run sees what a local run would. The shared index and HEAD stay untouched. Undefined outside a git repo.
 */
export const snapshotWorkingTree = (cwd = process.cwd(), env = process.env) => {
  const git = (args, extra = {}) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...env, ...extra } });
    return result.status === 0 ? result.stdout.trim() : undefined;
  };
  const top = git(['rev-parse', '--show-toplevel']);
  const head = top && git(['rev-parse', '--verify', 'HEAD^{commit}']);
  const sharedIndex = top && git(['rev-parse', '--path-format=absolute', '--git-path', 'index']);
  const commonDir = top && git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (!head || !sharedIndex || !commonDir) return undefined;
  const repo = (basename(commonDir) === '.git' ? basename(dirname(commonDir)) : basename(commonDir, '.git')).replace(
    /[^\w.-]/g,
    '-',
  );
  const index = resolve(tmpdir(), `heavy-index-${process.pid}-${Date.now()}`);
  try {
    if (existsSync(sharedIndex)) copyFileSync(sharedIndex, index);
    const own = { GIT_INDEX_FILE: index };
    if (git(['-C', top, 'add', '-A'], own) === undefined) return undefined;
    const tree = git(['write-tree'], own);
    if (!tree) return undefined;
    const sha =
      tree === git(['rev-parse', 'HEAD^{tree}'])
        ? head
        : git(['commit-tree', tree, '-p', head, '-m', 'heavy working-tree snapshot'], SNAPSHOT_IDENTITY);
    if (!sha) return undefined;
    return { sha, top, rel: relative(top, realpathSync(cwd)), repo };
  } finally {
    rmSync(index, { force: true });
  }
};

export const PROBE_OK = 'heavy-probe-ok';
export const MIN_FREE_KB = 5 * 1024 * 1024;

const freeLine = (disk, path) => `echo "free_kb=$(df -Pk ${path} | awk 'NR==2{print $4}') disk=${disk}"`;

/**
 * The script a machine runs to show it can take a run: it prints the free space of every disk a run writes to and
 * ends with PROBE_OK only when the run's shell works. On rack that is the WSL distro with Docker, whose disk image
 * lives on C:.
 */
export const probeScript = (machine) =>
  MACHINES[machine].linux
    ? `${freeLine('C:', '/c')}
MSYS_NO_PATHCONV=1 wsl.exe -d ethlete --exec bash -c '${freeLine('wsl', '"$HOME"').replaceAll("'", `'\\''`)}; docker info >/dev/null 2>&1 && echo ${PROBE_OK}' </dev/null
`
    : `${freeLine('home', '"$HOME"')}
echo ${PROBE_OK}
`;

/** Reads a probe's exit code and output into whether the machine can take a run, and why not. */
export const probeVerdict = ({ status, stdout = '' }, minFreeKb = MIN_FREE_KB) => {
  if (status === 255 || status === null) return { usable: false, reason: 'does not answer' };
  const full = [...stdout.matchAll(/^free_kb=(\d+) disk=(\S+)/gm)].find(([, kb]) => Number(kb) < minFreeKb);
  if (full) return { usable: false, reason: `has ${(Number(full[1]) / 1024 / 1024).toFixed(1)} GB free on ${full[2]}` };
  if (status !== 0 || !stdout.includes(PROBE_OK)) return { usable: false, reason: `fails its probe (exit ${status})` };
  return { usable: true };
};

/** Whether the machine answers ssh, its run shell works, and its disks have room; a few seconds at most. */
export const machineHealth = (machine, env = process.env) =>
  probeVerdict(
    spawnSync(
      env['HEAVY_SSH'] ?? 'ssh',
      ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', HOSTS[machine].ssh, HOSTS[machine].shell],
      { input: probeScript(machine), encoding: 'utf8', timeout: 20_000, env },
    ),
    Number(env['HEAVY_MIN_FREE_KB'] ?? MIN_FREE_KB),
  );

const PINNED_JOB = /\b(serve|storybook|tauri|design|release|push-suite)\b/i;

/**
 * Whether a command must run on tank whatever its load: it writes into the working tree, compares pictures, needs
 * cargo, or starts or reads a tank-local server or build.
 */
export const jobIsPinned = (command) => {
  const words = command.join(' ').split(/\s+/).filter(Boolean);
  const verbs = words.filter((word) => !word.includes('/') && !SPEC_FILE.test(word)).join(' ');
  return (
    words.some((word) => WRITES_FILES.test(word)) ||
    PICTURE.test(verbs) ||
    NEEDS_CARGO.test(command.join(' ')) ||
    PINNED_JOB.test(verbs)
  );
};

export const REMOTES = ['rack', 'mac'];

/**
 * The machines a run tries, in order; the last one is always tank, and its lock is where a run waits when all are
 * busy. A movable job leaves a loaded tank for the first usable remote; a remote job tries the other remote too
 * while tank is loaded.
 */
export const machineOrder = ({ preferred, movable, tankLoaded, usable }) => {
  if (!movable) return preferred === 'tank' ? ['tank'] : [...(usable(preferred) ? [preferred] : []), 'tank'];
  const loaded = tankLoaded();
  if (preferred === 'tank' && !loaded) return ['tank'];
  const remotes =
    preferred === 'tank' ? REMOTES : [preferred, ...(loaded ? REMOTES.filter((m) => m !== preferred) : [])];
  return [...remotes.filter((machine) => usable(machine)), 'tank'];
};
