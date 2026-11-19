import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { CollectedEvent, OriginEvent } from '../model/event';
import { CheckoutKeys } from '../model/peer-path';
import { TimetrackProcessRunner } from '../transport/ports';
import { headReflogSpec } from './head';
import { branchOrNothing, gitBranchSwitchesIn } from './reflog-switch';

/**
 * The `day` a machine's branch timelines are stored under beside the day rows. A day key is a date, so this
 * never names a day, and its start lies past any range a day is read with or retention removes.
 */
export const BRANCH_TIMELINE_DAY = 'branches';
export const BRANCH_TIMELINE_DAY_START_MS = Number.MAX_SAFE_INTEGER - 2;

/** From `fromMs` until the next window starts, the checkout was on `branch`; detached when it has none. */
export type BranchWindow = { fromMs: number; branch?: string };

/** The branch one checkout was on over time, keyed by its repository key and never by its path. */
export type CheckoutBranchTimeline = { key: string; windows: BranchWindow[] };

/** The branch timelines a paired machine last sent. */
export type ReceivedBranchTimelines = { machineId: string; checkouts: readonly CheckoutBranchTimeline[] };

/** How far back a sent timeline reaches. */
export const BRANCH_TIMELINE_DAYS = 30;

const DAY_MS = 24 * 60 * 60_000;

const windowOf = (fromMs: number, name: string): BranchWindow => {
  const branch = branchOrNothing(name);

  return branch ? { fromMs, branch } : { fromMs };
};

/**
 * The windows of `git reflog show` output from the last one holding at `since` on. The first window starts
 * at 0 and holds the branch HEAD came from before the oldest switch, as `parseHeadBranchAt` reads it.
 */
export const branchWindowsIn = (options: { output: string; since: Date }): BranchWindow[] => {
  const switches = gitBranchSwitchesIn(options.output);
  const oldest = switches[0];

  if (!oldest) return [];

  const windows = [windowOf(0, oldest.from), ...switches.map((entry) => windowOf(entry.at.getTime(), entry.to))];
  const later = windows.findIndex((window) => window.fromMs > options.since.getTime());

  return later === -1 ? windows.slice(-1) : windows.slice(Math.max(later - 1, 0));
};

/** The branch a timeline says its checkout was on at an instant. */
export const branchAtIn = (options: { windows: readonly BranchWindow[]; at: Date }) =>
  options.windows.filter((window) => window.fromMs <= options.at.getTime()).pop()?.branch;

/**
 * The branch timeline of each repository this machine has a checkout of, read from the main checkout: a
 * linked worktree is left out, because a paired machine folds it onto its own checkout of the key.
 */
export const readBranchTimelines$ = (options: {
  processes: TimetrackProcessRunner;
  keys: CheckoutKeys;
  /** Each linked worktree mapped to its main checkout. */
  worktrees: Readonly<Record<string, string>>;
  now: Date;
}): Observable<CheckoutBranchTimeline[]> => {
  const mains = new Map<string, string>();

  for (const [path, key] of Object.entries(options.keys)) {
    const held = mains.get(key);

    if (options.worktrees[path] !== undefined) continue;
    if (held === undefined || path.length < held.length || (path.length === held.length && path < held)) {
      mains.set(key, path);
    }
  }

  if (!mains.size) return of([]);

  const since = new Date(options.now.getTime() - BRANCH_TIMELINE_DAYS * DAY_MS);

  return forkJoin(
    [...mains].map(([key, path]) =>
      options.processes.run$(headReflogSpec(path)).pipe(
        map((result) => ({
          key,
          windows: result.code === 0 ? branchWindowsIn({ output: result.stdout, since }) : [],
        })),
        catchError(() => of({ key, windows: [] })),
      ),
    ),
  ).pipe(
    map((found) =>
      found.filter((timeline) => timeline.windows.length).sort((left, right) => left.key.localeCompare(right.key)),
    ),
  );
};

/** The wire form of a machine's branch timelines, stored as its rows of {@link BRANCH_TIMELINE_DAY}. */
export const encodeBranchTimelines = (checkouts: readonly CheckoutBranchTimeline[]) => JSON.stringify({ checkouts });

const windowFrom = (value: unknown): BranchWindow | null => {
  if (typeof value !== 'object' || value === null) return null;

  const { fromMs, branch } = value as Record<string, unknown>;

  if (typeof fromMs !== 'number') return null;

  return typeof branch === 'string' && branch ? { fromMs, branch } : { fromMs };
};

/** A paired machine's branch timelines read field by field; what no version of this app wrote is left out. */
export const parseBranchTimelines = (json: string): CheckoutBranchTimeline[] => {
  try {
    const parsed: unknown = JSON.parse(json);
    const checkouts =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>)['checkouts'] : [];

    if (!Array.isArray(checkouts)) return [];

    return checkouts.flatMap((value: unknown) => {
      if (typeof value !== 'object' || value === null) return [];

      const { key, windows } = value as Record<string, unknown>;

      if (typeof key !== 'string' || !key || !Array.isArray(windows)) return [];

      const read = windows.map(windowFrom).filter((window) => window !== null);

      return read.length ? [{ key, windows: read.sort((left, right) => left.fromMs - right.fromMs) }] : [];
    });
  } catch {
    return [];
  }
};

const pathsOf = (event: CollectedEvent): (string | undefined)[] => {
  switch (event.kind) {
    case 'git-commit':
      return [event.repoPath, event.worktree];
    case 'git-checkout':
    case 'git-branch-update':
      return [event.repoPath];
    case 'agent-session':
    case 'agent-usage':
    case 'agent-prompt':
      return [event.cwd, event.workedIn];
    case 'editor-heartbeat':
      return [event.repoPath ?? event.directory];
    default:
      return [];
  }
};

const isUnder = (path: string | undefined, root: string) =>
  !!path && (path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}\\`));

/**
 * The branch each checkout was on that only paired machines worked in that day, from the timeline of the
 * paired machine that sent it. A checkout this machine holds an event of is left to its own reflog.
 */
export const peerHeadBranches = (options: {
  events: readonly OriginEvent[];
  repoPaths: readonly string[];
  localKeys: CheckoutKeys;
  timelines: readonly ReceivedBranchTimelines[];
  at: Date;
}): Record<string, string> => {
  const found: Record<string, string> = {};

  for (const repoPath of options.repoPaths) {
    const root = repoPath.replace(/[\\/]+$/, '');
    const key = options.localKeys[repoPath] ?? options.localKeys[root];
    const touching = options.events.filter((event) => pathsOf(event).some((path) => isUnder(path, root)));

    if (key === undefined || !touching.length || touching.some((event) => event.origin === 'local')) continue;

    const machines = new Set(touching.flatMap((event) => (event.origin === 'local' ? [] : [event.origin.machineId])));
    const branch = [...options.timelines]
      .filter((sent) => machines.has(sent.machineId))
      .sort((left, right) => left.machineId.localeCompare(right.machineId))
      .map((sent) => sent.checkouts.find((checkout) => checkout.key === key))
      .map((checkout) => (checkout ? branchAtIn({ windows: checkout.windows, at: options.at }) : undefined))
      .find((named) => named !== undefined);

    if (branch) found[repoPath] = branch;
  }

  return found;
};
