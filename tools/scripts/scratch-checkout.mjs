#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { linkInstalledDependencies } from './commit-export.mjs';

const MARKER = '.scratch-checkout';
// An Nx daemon installs nx@latest into /tmp/tmp-<pid>-* and leaves it there when the copy goes away under it.
export const NX_LOCAL_ENV = 'NX_DAEMON=false\n';
const USAGE = 'usage: yarn scratch:checkout [<dir>] | --remove <dir>';

export const NO_GIT_NOTE =
  'scratch-checkout: the copy has no git, so `yarn et:design` does not run in it; run `npx nx build cli` there, then `node dist/libs/cli/src/index.js design ...`';

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

/** Copies the working tree (tracked files with uncommitted edits, plus untracked unignored files) into `dir` and links the repo's dependencies. */
export const scratchCheckout = (repo, dir) => {
  if (existsSync(dir) && readdirSync(dir).length) return { error: `${dir} exists and is not empty` };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MARKER), '');
  const copy = spawnSync(
    'bash',
    [
      '-c',
      'set -o pipefail; { git ls-files -z --cached --others --exclude-standard; } | while IFS= read -r -d "" f; do [ -e "$f" ] && printf "%s\\0" "$f"; done | tar --null -T - -c | tar -x -C "$1"',
      'scratch',
      dir,
    ],
    { cwd: repo, encoding: 'utf8' },
  );
  if (copy.status !== 0) return { error: copy.stderr.trim() || `copy exited ${copy.status}` };
  linkInstalledDependencies(repo, dir);
  writeFileSync(join(dir, '.local.env'), NX_LOCAL_ENV);
  mkdirSync(join(dir, 'node_modules/.design-explore'), { recursive: true });
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
  console.error(NO_GIT_NOTE);
  console.error(`scratch-checkout: remove it with \`yarn scratch:checkout --remove ${result.dir}\``);
  console.log(result.dir);
}
