import { Observable, catchError, concatMap, from, map, of, toArray } from 'rxjs';
import { CollectedEvent, MergeRequestActivityEvent, MergeRequestChangesEvent } from '../model/event';
import { CheckoutKeys } from '../model/peer-path';
import { TimetrackProcessRunner } from '../transport/ports';

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

/**
 * One `merge-request-changes` event per forge activity and checkout of its project that holds the
 * merge request's branch. Each branch is read once per call, so re-reading a day costs one `git log`
 * per merge request rather than per event.
 */
export const collectMergeRequestChanges$ = (options: {
  processes: TimetrackProcessRunner;
  events: readonly CollectedEvent[];
  repoKeys: CheckoutKeys;
}): Observable<MergeRequestChangesEvent[]> => {
  const activity = options.events.filter(isMergeRequestActivity);
  const reads = new Map<string, { repoPath: string; branch: string }>();

  for (const event of activity) {
    for (const repoPath of checkoutsOfProject({ projectPath: event.projectPath, repoKeys: options.repoKeys })) {
      reads.set(`${repoPath}\u001f${event.branch}`, { repoPath, branch: event.branch });
    }
  }

  return from([...reads.entries()]).pipe(
    concatMap(([key, read]) =>
      options.processes.run$({ command: 'git', args: mergeRequestChangesArgs(read.branch), cwd: read.repoPath }).pipe(
        map((result) => [key, result.code === 0 ? parseMergeRequestChanges(result.stdout) : null] as const),
        catchError(() => of([key, null] as const)),
      ),
    ),
    toArray(),
    map((results) => {
      const changes = new Map(results);

      return activity.flatMap((event) =>
        checkoutsOfProject({ projectPath: event.projectPath, repoKeys: options.repoKeys }).flatMap(
          (repoPath): MergeRequestChangesEvent[] => {
            const read = changes.get(`${repoPath}\u001f${event.branch}`);

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
          },
        ),
      );
    }),
  );
};
