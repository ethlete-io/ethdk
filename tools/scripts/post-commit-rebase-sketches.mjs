import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureCliCopy } from './studio-code.mjs';

const TIMEOUT_MS = 120_000;

/**
 * Whether a commit with these `git diff-tree --name-status` lines changed a design part: a file under `.ethlete/design`
 * outside `sketches/`. A commit that deletes a `sketch.json` is a merge or a discard, which rebases the others itself.
 */
export const changesDesignParts = (lines) => {
  const changes = lines.map((line) => line.split('\t')).filter(([status, path]) => status && path);

  return (
    !changes.some(
      ([status, path]) => status === 'D' && /^\.ethlete\/design\/.*\/sketches\/[^/]+\/sketch\.json$/u.test(path),
    ) && changes.some(([, path]) => path.startsWith('.ethlete/design/') && !path.includes('/sketches/'))
  );
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

const midSequence = (root) =>
  ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].some((name) => {
    const path = git(root, ['rev-parse', '--git-path', name]).stdout.trim();

    return path !== '' && existsSync(resolve(root, path));
  });

const main = () => {
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const listed = git(root, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', 'HEAD']);

  if (listed.status !== 0 || !changesDesignParts(listed.stdout.split('\n')) || midSequence(root)) return;

  const entry =
    process.env.ETHLETE_DESIGN_CLI_ENTRY ??
    ensureCliCopy(root, { keepWhenDirty: false, log: () => undefined, build: null })?.entry ??
    null;

  if (entry === null) {
    console.log('post-commit: no built design CLI for this head - run yarn et:design status to see stale sketches.');

    return;
  }

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

  if (files.length === 0) return;

  const added = git(root, ['add', '--all', '--', ...files]);
  const committed =
    added.status === 0
      ? git(root, ['commit', '-m', `fix(repo): Rebase the sketches ${head} made stale`, '--', ...files])
      : added;

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
