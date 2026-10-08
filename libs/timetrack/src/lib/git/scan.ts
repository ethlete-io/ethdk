import { Observable, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GitArrival, gitArrivalArgs, gitArrivalsOf, gitArrivedAt } from './arrival';
import { GIT_LOG_FORMAT, GIT_REFLOG_FORMAT, GitScanWindow } from './format';
import { parseGitLog } from './log';
import { parseGitBranchReflog, parseGitReflog } from './reflog';
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

/**
 * `HEAD` and every local branch in one call: a branch an agent rebased or merged without checking it
 * out moves only its own reflog.
 */
const gitReflogArgs = () => [
  'reflog',
  'show',
  '--date=iso-strict',
  `--format=${GIT_REFLOG_FORMAT}`,
  'HEAD',
  '--branches',
];

/**
 * Merges are left out: the subject is generated text rather than a statement of what was worked on, and
 * the commits it brings in are already reported under their own branch.
 *
 * No `--until`: it reads the commit date, so a commit authored inside the window and rebased after it
 * would never be listed. `parseGitLog` applies the upper bound to the author date.
 */
const gitLogArgs = (repo: GitRepoScan) => [
  'log',
  '--branches',
  '--no-merges',
  '--name-only',
  `--since=${repo.window.from.toISOString()}`,
  `--format=${GIT_LOG_FORMAT}`,
  ...(repo.author ? ['--fixed-strings', `--author=${repo.author}`] : []),
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
 * Which configured checkout holds each branch, and which other worktree holds the rest. A branch
 * checked out in a worktree the user never configured keeps its commits on the checkout the log was
 * read from rather than opening a row for a repository nobody asked about, but the commit still names
 * that worktree.
 */
const holdersOf = (group: RepoGroup) => {
  const configured = new Map(group.members.map((member) => [trimmedPath(member.repo.path), member.repo.path]));
  const owners = new Map<string, string>();
  const worktrees = new Map<string, string>();

  for (const worktree of worktreesOf(group.scanner)) {
    if (!worktree.branch) continue;

    const owner = configured.get(trimmedPath(worktree.path));

    if (owner) owners.set(worktree.branch, owner);
    else worktrees.set(worktree.branch, trimmedPath(worktree.path));
  }

  return { owners, worktrees };
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

const logScanOf = (options: { group: RepoGroup; log: GitRun; arrived: ReadonlyMap<string, Date> }): GitScanResult => {
  const { group, log, arrived } = options;
  const repo = group.scanner.repo;
  const failure = failureOf({ repoPath: repo.path, run: log });
  const { owners, worktrees } = holdersOf(group);
  const reflog = group.scanner.reflog.result;

  return {
    events: [
      ...(log.result.code === 0
        ? parseGitLog({
            repoPath: repo.path,
            output: log.result.stdout,
            window: repo.window,
            owners,
            worktrees,
            arrived,
          })
        : []),
      ...(reflog.code === 0
        ? parseGitBranchReflog({ repoPath: repo.path, output: reflog.stdout, window: repo.window, owners })
        : []),
    ],
    failures: failure ? [failure] : [],
  };
};

/**
 * When each commit of the group that this machine received rather than wrote first arrived. Read from
 * every checkout's reflog, since a commit written in a worktree is recorded in that worktree's own.
 */
const arrivedOf$ = (options: {
  processes: TimetrackProcessRunner;
  group: RepoGroup;
}): Observable<Map<string, Date>> => {
  const { processes, group } = options;
  const repo = group.scanner.repo;
  const arrivals = gitArrivalsOf({
    outputs: group.members.flatMap((member) => (member.reflog.result.code === 0 ? [member.reflog.result.stdout] : [])),
    window: repo.window,
  });

  if (!arrivals.arrivals.length) return of(new Map<string, Date>());

  return from(arrivals.arrivals).pipe(
    concatMap((arrival: GitArrival) =>
      run$({
        processes,
        spec: gitSpec({ repoPath: repo.path, args: gitArrivalArgs({ arrival, window: repo.window }) }),
      }).pipe(map((run) => ({ arrival, output: run.result.code === 0 ? run.result.stdout : '' }))),
    ),
    toArray(),
    map((listed) => gitArrivedAt({ arrivals, listed })),
  );
};

const merged = (scans: GitScanResult[]): GitScanResult => ({
  events: scans.flatMap((scan) => scan.events).sort((a, b) => a.at.getTime() - b.at.getTime()),
  failures: scans.flatMap((scan) => scan.failures),
});

/**
 * Reads a day out of the configured repositories: the branch switches from each one's reflog, the
 * moves of its local branches, and the commits authored inside the window, as collected events.
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
          forkJoin({
            log: run$({
              processes: options.processes,
              spec: gitSpec({ repoPath: group.scanner.repo.path, args: gitLogArgs(group.scanner.repo) }),
            }),
            arrived: arrivedOf$({ processes: options.processes, group }),
          }).pipe(map(({ log, arrived }) => logScanOf({ group, log, arrived }))),
        ),
        toArray(),
        map((logs) => merged([...probes.map(probeScanOf), ...logs])),
      ),
    ),
  );
};
