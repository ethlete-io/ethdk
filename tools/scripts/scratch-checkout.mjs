#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { linkInstalledDependencies } from './commit-export.mjs';

const MARKER = '.scratch-checkout';
// An Nx daemon installs nx@latest into /tmp/tmp-<pid>-* and leaves it there when the copy goes away under it.
export const NX_LOCAL_ENV = 'NX_DAEMON=false\n';
const USAGE = 'usage: yarn scratch:checkout [<dir>] | --remove <dir>';

export const USE_NOTE =
  'scratch-checkout: the copy is a git repo of its own with one commit of the working tree; run `npx nx build cli` there, then `node dist/libs/cli/src/index.js design ...`';

// Not excluded, renaming one (resident-e2e does) reads as a changed root input and restarts the harness build.
const OWN_FILES = [MARKER, `${MARKER}.resident-e2e`, '.local.env'];

const ownGitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

/** Makes `dir` a git repo of its own whose one commit holds every copied file, so git-keyed caches work in it. */
export const commitCopy = (dir) => {
  const git = (...args) =>
    spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args], {
      cwd: dir,
      env: ownGitEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const init = git('init', '-q');
  if (init.status !== 0) return { error: `git init in the copy: ${init.stderr.trim()}` };
  appendFileSync(join(dir, '.git/info/exclude'), `${OWN_FILES.map((name) => `/${name}`).join('\n')}\n`);
  for (const [step, args] of [
    ['add', ['add', '--all']],
    [
      'commit',
      ['-c', 'user.name=scratch', '-c', 'user.email=scratch@localhost', 'commit', '-q', '--no-verify', '-m', 'scratch'],
    ],
  ]) {
    const result = git(...args);
    if (result.status !== 0) return { error: `git ${step} in the copy: ${result.stderr.trim()}` };
  }
  return {};
};

/** The scratch directory a call with no target uses: on the home disk, never in the temp dir. */
export const defaultScratchDir = (home = homedir(), now = Date.now()) =>
  join(home, '.cache/ethlete-scratch', `scratch-${now}`);

const inside = (parent, path) => {
  const rel = relative(parent, path);
  return !rel.startsWith('..') && !isAbsolute(rel);
};

/** Reads the command line: `{ dir }`, `{ remove }`, or `{ error, code }`. */
export const scratchArgsOf = (args, { home = homedir(), temp = tmpdir(), now = Date.now() } = {}) => {
  if (args[0] === '--remove') {
    if (!args[1] || args[1].startsWith('-')) return { error: USAGE, code: 2 };
    return { remove: resolve(args[1]) };
  }
  if (args[0] === '--help' || args[0] === '-h') return { error: USAGE, code: 0 };
  if (args[0]?.startsWith('-')) return { error: `unknown flag ${args[0]}\n${USAGE}`, code: 2 };
  if (!args[0]) return { dir: defaultScratchDir(home, now) };
  const dir = resolve(args[0]);
  if (inside(resolve(temp), dir))
    return {
      error: `${dir} lies in the temp dir ${temp}; a scratch copy fills its inodes. Use a dir on the home disk, or no dir for ${join(home, '.cache/ethlete-scratch')}`,
      code: 2,
    };
  return { dir };
};

/** Removes a directory that `scratchCheckout` made; refuses any other directory. */
export const removeScratch = (dir) => {
  if (!existsSync(join(dir, MARKER))) return { error: `${dir} is no scratch checkout (no ${MARKER})` };
  rmSync(dir, { recursive: true, force: true });
  return { removed: dir };
};

/** Returns an error when a scratch's shot store resolves into the main checkout. */
export const storeEscapes = (repo, dir) => {
  const store = join(dir, 'node_modules/.design-explore');
  if (!existsSync(store)) return undefined;
  const real = realpathSync(store);
  const root = realpathSync(repo);
  return real === root || real.startsWith(root + sep)
    ? `the scratch shot store ${store} resolves to ${real}, inside the main checkout ${root}; a scratch run would write into the live store`
    : undefined;
};

/**
 * Copies the working tree (tracked files with uncommitted edits, plus untracked unignored files, without untracked nested
 * git repos such as a stray scratch copy) into `dir` and links the repo's dependencies. Refuses a `dir` inside `repo`.
 */
export const scratchCheckout = (repo, dir) => {
  if ([resolve(repo), realpathSync(repo)].some((root) => inside(root, resolve(dir))))
    return { error: `${dir} lies inside the checkout ${repo}; the next scratch copy would copy it along` };
  if (existsSync(dir) && readdirSync(dir).length) return { error: `${dir} exists and is not empty` };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MARKER), '');
  const copy = spawnSync(
    'bash',
    [
      '-c',
      'set -o pipefail; { git ls-files -z --cached --others --exclude-standard; } | while IFS= read -r -d "" f; do case "$f" in */) continue ;; esac; [ -e "$f" ] && printf "%s\\0" "$f"; done | tar --null -T - -c | tar -x -C "$1"',
      'scratch',
      dir,
    ],
    { cwd: repo, encoding: 'utf8' },
  );
  if (copy.status !== 0) return { error: copy.stderr.trim() || `copy exited ${copy.status}` };
  linkInstalledDependencies(repo, dir);
  writeFileSync(join(dir, '.local.env'), NX_LOCAL_ENV);
  mkdirSync(join(dir, 'node_modules/.design-explore'), { recursive: true });
  const committed = commitCopy(dir);
  if (committed.error) return { error: committed.error };
  const escape = storeEscapes(repo, dir);
  if (escape) return { error: escape };
  return { dir };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const parsed = scratchArgsOf(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(parsed.code);
  }
  if (parsed.remove) {
    const removed = removeScratch(parsed.remove);
    if (removed.error) {
      console.error(`scratch-checkout: ${removed.error}`);
      process.exit(1);
    }
    console.log(`removed ${removed.removed}`);
    process.exit(0);
  }
  const repo = process.env['ETHLETE_REPO_ROOT'] ?? resolve(import.meta.dirname, '../..');
  const result = scratchCheckout(repo, parsed.dir);
  if (result.error) {
    console.error(`scratch-checkout: ${result.error}`);
    process.exit(1);
  }
  console.error(USE_NOTE);
  console.error(`scratch-checkout: remove it with \`yarn scratch:checkout --remove ${result.dir}\``);
  console.log(result.dir);
}
