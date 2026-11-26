import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, relative, resolve } from 'node:path';
import { HOSTS } from './remote-run.mjs';

/** The machines heavy.mjs routes to, with their slot counts; `tank` is this PC. */
export const MACHINES = {
  tank: { slots: 3 },
  rack: { slots: 2, linux: true },
  mac: { slots: 1 },
};

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

/** Whether the machine answers ssh within a few seconds. */
export const machineIsUp = (machine, env = process.env) =>
  spawnSync(
    env['HEAVY_SSH'] ?? 'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', HOSTS[machine].ssh, 'exit 0'],
    { stdio: 'ignore', timeout: 8_000, env },
  ).status === 0;
