import { Observable, catchError, concatMap, from, map, of, reduce } from 'rxjs';
import { ForgePagingOptions } from '../forge/cli';
import { CollectedEvent, MergeRequestActivityEvent } from '../model/event';
import { TimetrackProcessRunner } from '../transport/ports';
import { GitHubEvent, fetchGitHubEvents$ } from './events';
import { GitHubPullRequest, fetchGitHubPullRequest$, gitHubPullRequestUrl } from './pull-requests';

export type GitHubCollection = {
  events: CollectedEvent[];
  /**
   * What could not be read, one line each. A pull request the login cannot see surfaces here rather
   * than failing the run — the rest of the day's activity is still worth storing.
   */
  failures: string[];
};

export type GitHubCollectOptions = {
  runner: TimetrackProcessRunner;
  /** The account the feed is read for. `probeForgeAuth$` is where it comes from. */
  login: string;
  from: Date;
  to: Date;
  /**
   * How many pull requests one run may look up. A day of ordinary work touches a handful; the bound is
   * what keeps a first run over a wide window from making hundreds of calls.
   */
  maxPullRequestLookups?: number;
  paging?: Partial<ForgePagingOptions>;
};

export const DEFAULT_MAX_PULL_REQUEST_LOOKUPS = 40;

type Lookup = { key: string; pullRequest: GitHubPullRequest | null; failure: string | null };

type Resolved = { read: Map<string, GitHubPullRequest>; failures: string[] };

const keyOf = (event: GitHubEvent) => `${event.repo}!${event.pullRequestNumber}`;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The pull requests the window's events leave half-named, each read once.
 *
 * Neither payload shape carries both halves: a comment gives the title and no head ref, and everything
 * else gives the head ref and no title. So an event is worth a lookup whenever either is missing, and
 * the lookup is per pull request rather than per event.
 */
const resolvePullRequests$ = (options: GitHubCollectOptions, events: GitHubEvent[]): Observable<Resolved> => {
  const wanted = new Map<string, GitHubEvent>();

  for (const event of events) {
    if (event.branch && event.title) continue;

    wanted.set(keyOf(event), event);
  }

  const limit = options.maxPullRequestLookups ?? DEFAULT_MAX_PULL_REQUEST_LOOKUPS;
  const lookups = [...wanted.values()].slice(0, limit);
  const dropped = wanted.size - lookups.length;
  const initial: Resolved = {
    read: new Map(),
    failures: dropped > 0 ? [`${dropped} more pull request(s) were not read: the per-run lookup cap was reached.`] : [],
  };

  if (lookups.length === 0) return of(initial);

  return from(lookups).pipe(
    concatMap((event) =>
      fetchGitHubPullRequest$({
        runner: options.runner,
        repo: event.repo,
        number: event.pullRequestNumber,
      }).pipe(
        map((pullRequest): Lookup => ({ key: keyOf(event), pullRequest, failure: null })),
        catchError((error: unknown) => of<Lookup>({ key: keyOf(event), pullRequest: null, failure: messageOf(error) })),
      ),
    ),
    reduce((all: Resolved, entry) => {
      if (entry.pullRequest) all.read.set(entry.key, entry.pullRequest);
      if (entry.failure) all.failures.push(entry.failure);

      return all;
    }, initial),
  );
};

const toCollectedEvent = (options: {
  event: GitHubEvent;
  pullRequest?: GitHubPullRequest;
}): MergeRequestActivityEvent => {
  const { event, pullRequest } = options;

  return {
    at: event.at,
    source: 'github',
    kind: 'merge-request-activity',
    eventId: event.id,
    action: event.action,
    projectPath: event.repo,
    mergeRequestIid: event.pullRequestNumber,
    branch: event.branch ?? pullRequest?.branch,
    title: event.title || pullRequest?.title,
    url: gitHubPullRequestUrl({ repo: event.repo, number: event.pullRequestNumber }),
  };
};

/**
 * Reads a window of the user's own GitHub activity and returns it as events to store.
 *
 * Only activity about a pull request is kept, which is the whole of what the feed says about work:
 * a push to GitHub carries no pull request at all, and a starred repository is not a workday.
 *
 * The result is safe to re-collect: `dedupeKeyOf` keys each event by its source and GitHub's own id,
 * so a run that overlaps the last one appends nothing twice.
 */
export const collectGitHubEvents$ = (options: GitHubCollectOptions): Observable<GitHubCollection> =>
  fetchGitHubEvents$({
    runner: options.runner,
    login: options.login,
    from: options.from,
    to: options.to,
    paging: options.paging,
  }).pipe(
    concatMap((page) => {
      const capped = page.reachedBackTo
        ? [`GitHub's feed stops at 300 events, so this run reached back only to ${page.reachedBackTo.toISOString()}.`]
        : [];

      if (page.events.length === 0) return of<GitHubCollection>({ events: [], failures: capped });

      return resolvePullRequests$(options, page.events).pipe(
        map((resolved): GitHubCollection => ({
          events: page.events
            .map((event) => toCollectedEvent({ event, pullRequest: resolved.read.get(keyOf(event)) }))
            .sort((a, b) => a.at.getTime() - b.at.getTime()),
          failures: [...capped, ...resolved.failures],
        })),
      );
    }),
  );
