import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AREAS, ensureCliCopy, isDirty, workingTreeCliCopy } from './studio-code.mjs';

const TIMEOUT_MS = 120_000;

/**
 * Whether a commit with these `git diff-tree --name-status` lines changed a design part: a file under `.ethlete/design`
 * outside its product's `sketches/` folder. A commit that deletes a `sketch.json` is a merge or a discard, which
 * rebases the others itself.
 */
export const changesDesignParts = (lines) => {
  const changes = lines.map((line) => line.split('\t')).filter(([status, path]) => status && path);

  return (
    !changes.some(
      ([status, path]) => status === 'D' && /^\.ethlete\/design\/.*\/sketches\/[^/]+\/sketch\.json$/u.test(path),
    ) &&
    changes.some(
      ([, path]) => path.startsWith('.ethlete/design/') && !/^\.ethlete\/design\/[^/]+\/sketches\//u.test(path),
    )
  );
};

/** The CLI that runs the rebase: the head's CLI copy, else a build of a clean `libs/cli`; the caller removes `dir`. */
export const rebaseCliOf = ({ copy, cliDirty, buildWorkingTree }) => {
  if (copy) return { entry: copy.entry, dir: null };
  if (cliDirty) return null;

  const { entry, dir } = buildWorkingTree();

  return { entry, dir };
};

const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'GIT_INDEX_FILE'));

const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', env: gitEnv });

const dirtyPathsOf = (root, paths) => {
  const status = git(root, ['status', '--porcelain', '-z', '--no-renames', '--untracked-files=all', '--', ...paths]);

  return status.status === 0
    ? status.stdout
        .split('\0')
        .filter((entry) => /^.. /u.test(entry))
        .map((entry) => entry.slice(3))
    : [];
};

/** The files to commit after the rebase: dirty now below a rebased sketch folder, and not dirty before it ran. */
export const rebasedFilesOf = ({ dirtyBefore, dirtyAfter }) => {
  const before = new Set(dirtyBefore);

  return {
    files: dirtyAfter.filter((path) => !before.has(path)),
    kept: dirtyAfter.filter((path) => before.has(path)),
  };
};

const REBASE_UNCOMMITTED_FILE = 'rebase-uncommitted.json';

/**
 * The `rebase-uncommitted.json` entries after a rebase of `sketchDirs` at `commit`: a sketch with a file the rebase
 * left uncommitted is recorded, one whose rebase was committed whole is dropped.
 */
export const rebaseUncommittedAfter = ({ recorded, sketchDirs, uncommitted, commit }) => {
  const next = { ...recorded };

  for (const dir of sketchDirs) {
    const name = basename(dir);

    if (uncommitted.some((path) => path.startsWith(`${dir}/`))) next[name] = { commit };
    else delete next[name];
  }

  return next;
};

const recordUncommitted = (root, { sketchDirs, uncommitted, commit }) => {
  const byProduct = Map.groupBy(sketchDirs, (dir) => dirname(dirname(dir)));

  for (const [productDir, dirs] of byProduct) {
    const file = resolve(root, productDir, REBASE_UNCOMMITTED_FILE);
    let recorded;

    try {
      recorded = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    } catch {
      recorded = {};
    }

    const next = rebaseUncommittedAfter({ recorded, sketchDirs: dirs, uncommitted, commit });

    if (Object.keys(next).length === 0) rmSync(file, { force: true });
    else writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  }
};

const midSequence = (root) =>
  ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].some((name) => {
    const path = git(root, ['rev-parse', '--git-path', name]).stdout.trim();

    return path !== '' && existsSync(resolve(root, path));
  });

const main = () => {
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const listed = git(root, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', 'HEAD']);

  if (listed.status !== 0 || !changesDesignParts(listed.stdout.split('\n')) || midSequence(root)) return;

  const cli = process.env.ETHLETE_DESIGN_CLI_ENTRY
    ? { entry: process.env.ETHLETE_DESIGN_CLI_ENTRY, dir: null }
    : rebaseCliOf({
        copy: ensureCliCopy(root, { keepWhenDirty: false, log: () => undefined, build: null }),
        cliDirty: isDirty(root, AREAS.cli),
        buildWorkingTree: () => workingTreeCliCopy(root, { id: `post-commit-${process.pid}`, log: () => undefined }),
      });

  if (cli === null) {
    console.log('post-commit: libs/cli has uncommitted changes and no build of this head - run yarn et:design status.');

    return;
  }

  try {
    rebaseWith(root, cli.entry);
  } finally {
    if (cli.dir) rmSync(cli.dir, { recursive: true, force: true });
  }
};

const rebaseWith = (root, entry) => {
  const head = git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim() || 'HEAD';
  const dirtyBefore = dirtyPathsOf(root, ['.ethlete/design']);
  const run = spawnSync(process.execPath, [entry, 'design', 'sketch', 'rebase-open', '--commit', head, '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });

  if (run.status !== 0) {
    console.log('post-commit: the sketch rebase did not finish - run yarn et:design status.');

    return;
  }

  const { lines, dirs } = JSON.parse(run.stdout.trim().split('\n').at(-1) ?? '{}');

  if (!dirs?.length) return;

  const sketchDirs = dirs.map((dir) => relative(root, realpathSync(dir)).split(sep).join('/'));
  const { files, kept } = rebasedFilesOf({ dirtyBefore, dirtyAfter: dirtyPathsOf(root, sketchDirs) });

  console.log(`post-commit: sketches this commit made stale:\n${lines.join('\n')}`);

  for (const path of kept) console.log(`post-commit: ${path} had uncommitted edits before the rebase - not committed`);

  if (files.length === 0) {
    recordUncommitted(root, { sketchDirs, uncommitted: kept, commit: head });

    return;
  }

  const added = git(root, ['add', '--all', '--', ...files]);
  const committed =
    added.status === 0
      ? git(root, ['commit', '-m', `fix(repo): Rebase the sketches ${head} made stale`, '--', ...files])
      : added;

  recordUncommitted(root, {
    sketchDirs,
    uncommitted: committed.status === 0 ? kept : [...files, ...kept],
    commit: head,
  });
  console.log(
    committed.status === 0
      ? `post-commit: committed the rebase of ${sketchDirs.join(', ')}`
      : `post-commit: could not commit the rebase: ${(committed.stderr || committed.stdout).trim()}`,
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.log(`post-commit: the sketch rebase failed (${error.message}) - run yarn et:design status.`);
  }
}
