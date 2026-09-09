import { Observable, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GIT_LOG_FORMAT, GIT_REFLOG_FORMAT, GitScanWindow } from './format';
import { parseGitLog } from './log';
import { parseGitReflog } from './reflog';
import { gitWorktreeArgs, parseGitWorktrees } from './worktree';

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

/** A trailing separator is the same directory, and git never prints one. */
const trimmedPath = (path: string) => path.replace(/\/+$/, '') || path;

type RepoProbe = { repo: GitRepoScan; reflog: GitRun; worktrees: GitRun };

/**
 * Every checkout of a repository shares one object database and one set of branches, so the commits
 * are read once per group and the reflogs once per checkout. A checkout whose `git worktree list`
 * failed is a group of its own, which is what the scan did before it read the list at all.
 */
type RepoGroup = { store: string; scanner: RepoProbe; members: RepoProbe[] };

const worktreesOf = (probe: RepoProbe) =>
  probe.worktrees.result.code === 0 ? parseGitWorktrees(probe.worktrees.result.stdout) : [];

const storeOf = (probe: RepoProbe) => trimmedPath(worktreesOf(probe)[0]?.path ?? probe.repo.path);

const groupsOf = (probes: RepoProbe[]): RepoGroup[] => {
  const groups = new Map<string, RepoGroup>();

  for (const probe of probes) {
    const store = storeOf(probe);
    const group = groups.get(store);

    if (!group) {
      groups.set(store, { store, scanner: probe, members: [probe] });
      continue;
    }

    group.members.push(probe);

    if (trimmedPath(probe.repo.path) === store) group.scanner = probe;
  }

  return [...groups.values()];
};

/**
 * Which configured checkout holds each branch. A branch checked out in a worktree the user never
 * configured is left out, so its commits stay on the checkout the log was read from rather than
 * opening a row for a repository nobody asked about.
 */
const ownersOf = (group: RepoGroup): ReadonlyMap<string, string> => {
  const configured = new Map(group.members.map((member) => [trimmedPath(member.repo.path), member.repo.path]));
  const owners = new Map<string, string>();

  for (const worktree of worktreesOf(group.scanner)) {
    const owner = worktree.branch ? configured.get(trimmedPath(worktree.path)) : undefined;

    if (worktree.branch && owner) owners.set(worktree.branch, owner);
  }

  return owners;
};

const probeOf = (options: { processes: TimetrackProcessRunner; repo: GitRepoScan }): Observable<RepoProbe> => {
  const { processes, repo } = options;

  return forkJoin({
    reflog: run$({ processes, spec: gitSpec({ repoPath: repo.path, args: gitReflogArgs() }) }),
    worktrees: run$({ processes, spec: gitSpec({ repoPath: repo.path, args: gitWorktreeArgs() }) }),
  }).pipe(map(({ reflog, worktrees }): RepoProbe => ({ repo, reflog, worktrees })));
};

const probeScanOf = (probe: RepoProbe): GitScanResult => ({
  events:
    probe.reflog.result.code === 0
      ? parseGitReflog({ repoPath: probe.repo.path, output: probe.reflog.result.stdout, window: probe.repo.window })
      : [],
  failures: [
    failureOf({ repoPath: probe.repo.path, run: probe.reflog }),
    failureOf({ repoPath: probe.repo.path, run: probe.worktrees }),
  ].filter((failure): failure is GitScanFailure => !!failure),
});

const logScanOf = (options: { group: RepoGroup; log: GitRun }): GitScanResult => {
  const { group, log } = options;
  const repo = group.scanner.repo;
  const failure = failureOf({ repoPath: repo.path, run: log });

  return {
    events:
      log.result.code === 0
        ? parseGitLog({
            repoPath: repo.path,
            output: log.result.stdout,
            window: repo.window,
            owners: ownersOf(group),
          })
        : [],
    failures: failure ? [failure] : [],
  };
};

const merged = (scans: GitScanResult[]): GitScanResult => ({
  events: scans.flatMap((scan) => scan.events).sort((a, b) => a.at.getTime() - b.at.getTime()),
  failures: scans.flatMap((scan) => scan.failures),
});

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
    concatMap((repo) => probeOf({ processes: options.processes, repo })),
    toArray(),
    concatMap((probes) =>
      from(groupsOf(probes)).pipe(
        concatMap((group) =>
          run$({
            processes: options.processes,
            spec: gitSpec({ repoPath: group.scanner.repo.path, args: gitLogArgs(group.scanner.repo) }),
          }).pipe(map((log) => logScanOf({ group, log }))),
        ),
        toArray(),
        map((logs) => merged([...probes.map(probeScanOf), ...logs])),
      ),
    ),
  );
};
