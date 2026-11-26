import { Observable, catchError, concat, concatMap, defer, from, map, of, toArray } from 'rxjs';
import { CollectedEvent, MergeRequestActivityEvent, MergeRequestChangesEvent } from '../model/event';
import { CheckoutKeys } from '../model/peer-path';
import { TimetrackProcessRunner } from '../transport/ports';
import { gitWorktreeArgs, parseGitWorktrees } from './worktree';

const HEAD_MARKER = '\u0000';

/**
 * The files the commits only `branch` holds changed, of every remote's copy of it: a merge request is
 * reviewed in a checkout that never checked its branch out, and a merged branch answers nothing.
 */
export const mergeRequestChangesArgs = (branch: string) => [
  'log',
  '--format=%x00%H',
  '--name-only',
  `--remotes=*/${branch}`,
  '--not',
  `--exclude=*/${branch}`,
  '--remotes',
];

export const parseMergeRequestChanges = (stdout: string): { head: string; directories: string[] } | null => {
  const lines = stdout.split('\n').map((line) => line.trim());
  const head = lines.find((line) => line.startsWith(HEAD_MARKER))?.slice(HEAD_MARKER.length);
  const directories = new Set<string>();

  for (const line of lines) {
    if (!line || line.startsWith(HEAD_MARKER)) continue;

    const slash = line.lastIndexOf('/');

    if (slash > 0) directories.add(line.slice(0, slash));
  }

  return head && directories.size ? { head, directories: [...directories].sort() } : null;
};

const lastSegment = (path: string) =>
  (
    path
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? ''
  ).toLowerCase();

/** The checkouts whose remote is the forge project `projectPath`, or that are named like it where none is keyed. */
export const checkoutsOfProject = (options: { projectPath: string; repoKeys: CheckoutKeys }) => {
  const project = options.projectPath.toLowerCase();
  const entries = Object.entries(options.repoKeys);
  const keyed = entries
    .filter(([, key]) => {
      const lower = key.toLowerCase();

      return lower === project || lower.endsWith(`/${project}`);
    })
    .map(([repoPath]) => repoPath);

  return keyed.length
    ? keyed
    : entries.filter(([repoPath]) => lastSegment(repoPath) === lastSegment(project)).map(([repoPath]) => repoPath);
};

const isMergeRequestActivity = (
  event: CollectedEvent,
): event is MergeRequestActivityEvent & { projectPath: string; mergeRequestIid: string; branch: string } =>
  event.kind === 'merge-request-activity' && !!event.projectPath && !!event.mergeRequestIid && !!event.branch;

const trimmedPath = (path: string) => path.replace(/\/+$/, '') || path;

/**
 * Checkouts that are worktrees of one repository share its branches, so each maps to the main
 * checkout's path and a checkout whose `git worktree list` fails is a group of its own.
 */
const storesOf$ = (options: {
  processes: TimetrackProcessRunner;
  repoPaths: readonly string[];
}): Observable<Map<string, string>> => {
  const stores = new Map<string, string>();

  if (options.repoPaths.length < 2) return of(stores);

  return concat(
    ...options.repoPaths.map((repoPath) =>
      defer(() => {
        if (stores.has(repoPath)) return of(null);

        return options.processes.run$({ command: 'git', args: gitWorktreeArgs(), cwd: repoPath }).pipe(
          map((result) => (result.code === 0 ? parseGitWorktrees(result.stdout) : [])),
          catchError(() => of([])),
          map((worktrees) => {
            const store = trimmedPath(worktrees[0]?.path ?? repoPath);

            stores.set(repoPath, store);

            for (const worktree of worktrees) {
              const member = options.repoPaths.find((path) => trimmedPath(path) === trimmedPath(worktree.path));

              if (member && !stores.has(member)) stores.set(member, store);
            }

            return null;
          }),
        );
      }),
    ),
  ).pipe(
    toArray(),
    map(() => stores),
  );
};

/**
 * One `merge-request-changes` event per forge activity and checkout of its project that holds the
 * merge request's branch. Each branch is read once per repository and call, however many worktrees
 * it has, so re-reading a day costs one `git log` per merge request rather than per event or worktree.
 */
export const collectMergeRequestChanges$ = (options: {
  processes: TimetrackProcessRunner;
  events: readonly CollectedEvent[];
  repoKeys: CheckoutKeys;
}): Observable<MergeRequestChangesEvent[]> => {
  const activity = options.events.filter(isMergeRequestActivity);
  const checkouts = new Map(
    activity.map((event) => [
      event.projectPath,
      checkoutsOfProject({ projectPath: event.projectPath, repoKeys: options.repoKeys }),
    ]),
  );
  const repoPaths = [...new Set([...checkouts.values()].flat())];

  return storesOf$({ processes: options.processes, repoPaths }).pipe(
    concatMap((stores) => {
      const storeOf = (repoPath: string) => stores.get(repoPath) ?? repoPath;
      const readKey = (repoPath: string, branch: string) => `${storeOf(repoPath)}\u001f${branch}`;
      const reads = new Map<string, { repoPath: string; branch: string }>();

      for (const event of activity) {
        for (const repoPath of checkouts.get(event.projectPath) ?? []) {
          const key = readKey(repoPath, event.branch);

          if (!reads.has(key)) reads.set(key, { repoPath, branch: event.branch });
        }
      }

      return from([...reads.entries()]).pipe(
        concatMap(([key, read]) =>
          options.processes
            .run$({ command: 'git', args: mergeRequestChangesArgs(read.branch), cwd: read.repoPath })
            .pipe(
              map((result) => [key, result.code === 0 ? parseMergeRequestChanges(result.stdout) : null] as const),
              catchError(() => of([key, null] as const)),
            ),
        ),
        toArray(),
        map((results) => {
          const changes = new Map(results);

          return activity.flatMap((event) =>
            (checkouts.get(event.projectPath) ?? []).flatMap((repoPath): MergeRequestChangesEvent[] => {
              const read = changes.get(readKey(repoPath, event.branch));

              return read
                ? [
                    {
                      at: event.at,
                      source: 'git',
                      kind: 'merge-request-changes',
                      repoPath,
                      eventId: event.eventId,
                      projectPath: event.projectPath,
                      mergeRequestIid: event.mergeRequestIid,
                      branch: event.branch,
                      head: read.head,
                      directories: read.directories,
                    },
                  ]
                : [];
            }),
          );
        }),
      );
    }),
  );
};
