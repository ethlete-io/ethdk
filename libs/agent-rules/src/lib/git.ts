import { execFileSync } from 'child_process';
import { stripRefPrefix } from './git-flow';

export const git = (options: { root: string; args: string[] }) =>
  execFileSync('git', options.args, { cwd: options.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Runs a command whose output belongs on the terminal — a push, a fetch, a branch creation. */
export const gitLoud = (options: { root: string; args: string[] }) =>
  execFileSync('git', options.args, { cwd: options.root, encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] });

export const currentBranch = (root: string) => git({ root, args: ['rev-parse', '--abbrev-ref', 'HEAD'] });

export const allBranches = (root: string) => {
  const refs = git({ root, args: ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'] });
  const names = refs
    .split('\n')
    .filter((ref) => ref && !ref.endsWith('/HEAD'))
    .map(stripRefPrefix);

  return [...new Set(names)].sort();
};

export const isDirty = (root: string) => git({ root, args: ['status', '--porcelain'] }).length > 0;

const refExists = (options: { root: string; ref: string }) => {
  try {
    git({ root: options.root, args: ['rev-parse', '--verify', '--quiet', options.ref] });

    return true;
  } catch {
    return false;
  }
};

export const localBranchExists = (options: { root: string; branch: string }) =>
  refExists({ root: options.root, ref: `refs/heads/${options.branch}` });

export const remoteBranchExists = (options: { root: string; remote: string; branch: string }) =>
  git({ root: options.root, args: ['ls-remote', '--heads', options.remote, options.branch] }).length > 0;

/** `origin` when it exists, otherwise the only remote — a repo with several and no `origin` is ambiguous. */
export const defaultRemote = (root: string) => {
  const remotes = git({ root, args: ['remote'] })
    .split('\n')
    .filter(Boolean);

  if (remotes.includes('origin')) return 'origin';

  return remotes.length === 1 ? remotes[0] : undefined;
};

export const remoteUrl = (options: { root: string; remote: string }) =>
  git({ root: options.root, args: ['remote', 'get-url', options.remote] });

/** One commit as a repair reads it: the local day it was made on, and the files it changed. */
export type CommitPaths = { day: string; paths: string[] };

/**
 * The commits of the given local days, with the files each changed.
 *
 * `%cd` with `--date=format-local:%F` is the day in the machine's own zone, which is the grain
 * Timetrack keys a day by. The span is read from the days given, so one `git log` answers them all,
 * and a commit on a day outside the list is dropped.
 */
export const commitPathsOnDays = (options: { root: string; days: readonly string[]; author?: string }) => {
  const wanted = new Set(options.days);
  const sorted = [...wanted].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first || !last) return [];

  const out = git({
    root: options.root,
    args: [
      'log',
      '--name-only',
      '--no-merges',
      '--pretty=format:%x00%cd',
      '--date=format-local:%F',
      `--since=${first} 00:00`,
      `--until=${last} 23:59:59`,
      ...(options.author ? [`--author=${options.author}`] : []),
    ],
  });

  return out
    .split('\0')
    .flatMap((block): CommitPaths | [] => {
      const lines = block.split('\n').filter(Boolean);
      const day = lines.shift() ?? '';

      return wanted.has(day) && lines.length ? { day, paths: lines } : [];
    })
    .reverse();
};
