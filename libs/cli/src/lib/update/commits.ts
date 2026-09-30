import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync, realpathSync } from 'fs';
import { join, relative, sep } from 'path';
import { UPDATE_DIR } from './tasks';

/** Repo-relative paths git reports as changed or untracked, each with a hash of its content. */
export type DirtySnapshot = Record<string, string>;

/** What the commits of one update compare against. It lives in the pending update, so a `--continue` keeps it. */
export type CommitState = {
  /** The paths that were dirty before the update wrote anything: the user's own work, never committed. */
  baseline: DirtySnapshot;
  /** The dirty paths after the last step, so the next step commits only what it changed. */
  snapshot: DirtySnapshot;
  bumped: boolean;
};

export type StepCommit =
  | { state: 'unchanged' }
  | { state: 'committed'; hash: string; paths: string[] }
  | { state: 'blocked'; paths: string[] }
  | { state: 'failed'; reason: string; paths: string[] };

const git = (cwd: string, args: string[]) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });

  return {
    status: result.error ? 1 : (result.status ?? 1),
    stdout: result.stdout ?? '',
    stderr: (result.stderr ?? '').trim() || (result.error?.message ?? ''),
  };
};

const contentHash = (path: string) => {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex');
  } catch {
    return 'missing';
  }
};

const topLevel = (root: string) => {
  const result = git(root, ['rev-parse', '--show-toplevel']);

  const top = result.stdout.trim();

  return result.status === 0 && top.length > 0 ? top : undefined;
};

/** The paths of `git status --porcelain -z`, a rename's source included. */
export const parsePorcelain = (output: string) => {
  const entries = output.split('\0').filter((entry) => entry.length > 0);
  const paths: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? '';
    const status = entry.slice(0, 2);

    paths.push(entry.slice(3));

    if (status.includes('R') || status.includes('C')) {
      const source = entries[index + 1];

      if (source !== undefined) paths.push(source);

      index += 1;
    }
  }

  return paths;
};

const updateDirPrefix = (options: { root: string; top: string }) => {
  const fromTop = relative(options.top, realpathSync(options.root)).split(sep).join('/');

  return fromTop.length === 0 ? `${UPDATE_DIR}/` : `${fromTop}/${UPDATE_DIR}/`;
};

/** The dirty paths of the checkout `root` sits in, or `undefined` outside a git checkout. */
export const dirtySnapshot = (root: string): DirtySnapshot | undefined => {
  const top = topLevel(root);

  if (top === undefined) return undefined;

  const status = git(top, ['status', '--porcelain', '-z', '--untracked-files=all']);

  if (status.status !== 0) return undefined;

  const ignored = updateDirPrefix({ root, top });

  return Object.fromEntries(
    parsePorcelain(status.stdout)
      .filter((path) => !path.startsWith(ignored))
      .map((path) => [path, contentHash(join(top, path))]),
  );
};

/** The commit state of an update that starts now, or `undefined` outside a git checkout. */
export const startCommits = (root: string): CommitState | undefined => {
  const snapshot = dirtySnapshot(root);

  return snapshot === undefined ? undefined : { baseline: snapshot, snapshot, bumped: false };
};

const changedSince = (options: { before: DirtySnapshot; now: DirtySnapshot }) =>
  Object.keys(options.now).filter((path) => options.before[path] !== options.now[path]);

/**
 * Commits what one step changed since the last one, and nothing else. A step that touched a path the user
 * had changed before the update is not committed at all, so their work never lands in an update commit.
 */
export const commitStep = (options: {
  root: string;
  state: CommitState;
  message: string;
  body?: string;
}): { state: CommitState; commit: StepCommit } => {
  const { root, state, message, body } = options;
  const now = dirtySnapshot(root);
  const top = topLevel(root);

  if (now === undefined || top === undefined) {
    return { state, commit: { state: 'failed', reason: 'git status failed', paths: [] } };
  }

  const paths = changedSince({ before: state.snapshot, now });
  const settle = (commit: StepCommit) => ({ state: { ...state, snapshot: dirtySnapshot(root) ?? now }, commit });

  if (paths.length === 0) return settle({ state: 'unchanged' });

  const blocked = paths.filter((path) => path in state.baseline);

  if (blocked.length > 0) return settle({ state: 'blocked', paths: blocked });

  const added = git(top, ['add', '--', ...paths]);

  if (added.status !== 0) return settle({ state: 'failed', reason: added.stderr, paths });

  const committed = git(top, ['commit', '-m', message, ...(body === undefined ? [] : ['-m', body]), '--', ...paths]);

  if (committed.status !== 0) {
    const reason = committed.stderr || committed.stdout.trim() || `git commit exited with ${committed.status}`;

    git(top, ['reset', '--quiet', '--', ...paths]);

    return settle({ state: 'failed', reason, paths });
  }

  return settle({ state: 'committed', hash: git(top, ['rev-parse', '--short', 'HEAD']).stdout.trim(), paths });
};

/** Moves the snapshot past a step that is not committed, so the next step does not pick up what it left. */
export const skipStep = (options: { root: string; state: CommitState }): CommitState => ({
  ...options.state,
  snapshot: dirtySnapshot(options.root) ?? options.state.snapshot,
});

const printCommit = (options: { message: string; commit: StepCommit }) => {
  const { message, commit } = options;

  if (commit.state === 'committed') console.log(`\n  Committed ${commit.hash}: ${message}`);

  if (commit.state === 'blocked') {
    console.error(
      `\n  Not committed: ${commit.paths.join(', ')} had uncommitted changes before the update. ` +
        `Commit "${message}" yourself.`,
    );
  }

  if (commit.state === 'failed') {
    console.error(`\n  The commit "${message}" failed, so its changes stay in the working tree:\n${commit.reason}`);
  }
};

export type StepCommitter = {
  readonly state: CommitState;
  commit: (step: { message: string; body?: string }) => StepCommit;
  skip: () => void;
  markBumped: () => void;
};

/** Commits the steps of one update in order, and hands every new state to `save`. */
export const createStepCommitter = (options: {
  root: string;
  state: CommitState;
  save: (state: CommitState) => void;
}): StepCommitter => {
  const { root, save } = options;
  let state = options.state;

  const update = (next: CommitState) => {
    state = next;
    save(state);
  };

  return {
    get state() {
      return state;
    },
    commit: (step) => {
      const result = commitStep({ root, state, ...step });

      update(result.state);
      printCommit({ message: step.message, commit: result.commit });

      return result.commit;
    },
    skip: () => update(skipStep({ root, state })),
    markBumped: () => update({ ...state, bumped: true }),
  };
};
