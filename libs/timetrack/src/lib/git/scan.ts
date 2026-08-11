import { Observable, concatMap, forkJoin, from, map, of, reduce } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GIT_LOG_FORMAT, GIT_REFLOG_FORMAT, GitScanWindow } from './format';
import { parseGitLog } from './log';
import { parseGitReflog } from './reflog';

export type GitRepoScan = {
  /** The repository's working-tree root. */
  path: string;
  window: GitScanWindow;
  /**
   * Restricts commits to one author, which is how rebasing or merging somebody else's work stays out of
   * the day. Without it every author's commits in the window arrive.
   */
  author?: string;
};

export type GitScanFailure = {
  repoPath: string;
  args: string[];
  code: number;
  stderr: string;
};

export type GitScanResult = {
  events: CollectedEvent[];
  /**
   * The commands that failed. A repository the user has moved or deleted surfaces here rather than
   * failing the scan, because one stale configured root must not cost the whole day.
   */
  failures: GitScanFailure[];
};

const gitReflogArgs = () => ['reflog', 'show', '--date=iso-strict', `--format=${GIT_REFLOG_FORMAT}`];

/**
 * Merges are left out: the subject is generated text rather than a statement of what was worked on, and
 * the commits it brings in are already reported under their own branch.
 */
const gitLogArgs = (repo: GitRepoScan) => [
  'log',
  '--branches',
  '--no-merges',
  `--since=${repo.window.from.toISOString()}`,
  `--until=${repo.window.to.toISOString()}`,
  `--format=${GIT_LOG_FORMAT}`,
  ...(repo.author ? [`--author=${repo.author}`] : []),
];

const gitSpec = (options: { repoPath: string; args: string[] }): ProcessSpec => ({
  command: 'git',
  args: options.args,
  cwd: options.repoPath,
});

type GitRun = { args: string[]; result: ProcessResult };

const run$ = (options: { processes: TimetrackProcessRunner; spec: ProcessSpec }): Observable<GitRun> =>
  options.processes.run$(options.spec).pipe(map((result): GitRun => ({ args: options.spec.args, result })));

const failureOf = (options: { repoPath: string; run: GitRun }): GitScanFailure | null =>
  options.run.result.code === 0
    ? null
    : {
        repoPath: options.repoPath,
        args: options.run.args,
        code: options.run.result.code,
        stderr: options.run.result.stderr,
      };

const scanOf = (options: { repo: GitRepoScan; reflog: GitRun; log: GitRun }): GitScanResult => {
  const { repo, reflog, log } = options;
  const events: CollectedEvent[] = [];

  if (reflog.result.code === 0) {
    events.push(...parseGitReflog({ repoPath: repo.path, output: reflog.result.stdout, window: repo.window }));
  }

  if (log.result.code === 0) {
    events.push(...parseGitLog({ repoPath: repo.path, output: log.result.stdout, window: repo.window }));
  }

  return {
    events,
    failures: [failureOf({ repoPath: repo.path, run: reflog }), failureOf({ repoPath: repo.path, run: log })].filter(
      (failure): failure is GitScanFailure => !!failure,
    ),
  };
};

/**
 * Reads a day out of the configured repositories: the branch switches from each one's reflog and the
 * commits authored inside the window, as collected events.
 *
 * This is the reconcile pass, and it stands on its own — it needs no watcher to have been running, so a
 * day still arrives after the app was closed. The host's inotify watch on `.git/HEAD` is what makes a
 * switch show up immediately instead of at the next scan.
 */
export const collectGitEvents$ = (options: {
  processes: TimetrackProcessRunner;
  repos: GitRepoScan[];
}): Observable<GitScanResult> => {
  if (options.repos.length === 0) return of({ events: [], failures: [] });

  return from(options.repos).pipe(
    concatMap((repo) =>
      forkJoin({
        reflog: run$({ processes: options.processes, spec: gitSpec({ repoPath: repo.path, args: gitReflogArgs() }) }),
        log: run$({ processes: options.processes, spec: gitSpec({ repoPath: repo.path, args: gitLogArgs(repo) }) }),
      }).pipe(map(({ reflog, log }) => scanOf({ repo, reflog, log }))),
    ),
    reduce(
      (all: GitScanResult, scan) => ({
        events: [...all.events, ...scan.events],
        failures: [...all.failures, ...scan.failures],
      }),
      { events: [], failures: [] },
    ),
    map((all) => ({ ...all, events: all.events.sort((a, b) => a.at.getTime() - b.at.getTime()) })),
  );
};
