import { Observable, catchError, concatMap, from, map, of, reduce } from 'rxjs';
import { CollectedEvent, MergeRequestActivityEvent } from '../model/event';
import { TimetrackTransport } from '../transport/ports';
import { GitLabCredentials, GitLabPagingOptions } from './client';
import { GitLabEvent, fetchGitLabEvents$ } from './events';
import { GitLabMergeRequest, fetchGitLabMergeRequest$ } from './merge-requests';

export type GitLabCollection = {
  events: CollectedEvent[];
  /**
   * What could not be read, one line each. A merge request the token cannot see surfaces here rather
   * than failing the run — the rest of the day's activity is still worth storing.
   */
  failures: string[];
};

export type GitLabCollectOptions = {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  from: Date;
  to: Date;
  /**
   * How many merge requests one run may look up. A day of ordinary work touches a handful; the bound
   * is what keeps a first run over a wide window from making hundreds of calls.
   */
  maxMergeRequestLookups?: number;
  paging?: Partial<GitLabPagingOptions>;
};

export const DEFAULT_MAX_MERGE_REQUEST_LOOKUPS = 40;

type Lookup = { key: string; mergeRequest: GitLabMergeRequest | null; failure: string | null };

type Resolved = { merged: Map<string, GitLabMergeRequest>; failures: string[] };

const keyOf = (event: GitLabEvent) => `${event.projectId}!${event.mergeRequestIid}`;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The merge requests the window's events name, each read once.
 *
 * A push already says which branch it moved, so only the events that do not — a note, an approval —
 * are worth a lookup, and the lookup is per merge request rather than per event.
 */
const resolveMergeRequests$ = (options: GitLabCollectOptions, events: GitLabEvent[]): Observable<Resolved> => {
  const wanted = new Map<string, GitLabEvent>();

  for (const event of events) {
    if (event.branch) continue;

    wanted.set(keyOf(event), event);
  }

  const limit = options.maxMergeRequestLookups ?? DEFAULT_MAX_MERGE_REQUEST_LOOKUPS;
  const lookups = [...wanted.values()].slice(0, limit);
  const dropped = wanted.size - lookups.length;
  const initial: Resolved = {
    merged: new Map(),
    failures:
      dropped > 0 ? [`${dropped} more merge request(s) were not read: the per-run lookup cap was reached.`] : [],
  };

  if (lookups.length === 0) return of(initial);

  return from(lookups).pipe(
    concatMap((event) =>
      fetchGitLabMergeRequest$({
        transport: options.transport,
        credentials: options.credentials,
        projectId: event.projectId,
        iid: event.mergeRequestIid ?? '',
      }).pipe(
        map((mergeRequest): Lookup => ({ key: keyOf(event), mergeRequest, failure: null })),
        catchError((error: unknown) =>
          of<Lookup>({ key: keyOf(event), mergeRequest: null, failure: messageOf(error) }),
        ),
      ),
    ),
    reduce((all: Resolved, entry) => {
      if (entry.mergeRequest) all.merged.set(entry.key, entry.mergeRequest);
      if (entry.failure) all.failures.push(entry.failure);

      return all;
    }, initial),
  );
};

const toCollectedEvent = (options: {
  event: GitLabEvent;
  mergeRequest?: GitLabMergeRequest;
}): MergeRequestActivityEvent => {
  const { event, mergeRequest } = options;

  return {
    at: event.at,
    source: 'gitlab',
    kind: 'merge-request-activity',
    eventId: event.id,
    action: event.action,
    projectPath: mergeRequest?.projectPath,
    mergeRequestIid: event.mergeRequestIid,
    branch: event.branch ?? mergeRequest?.sourceBranch,
    title: event.title || mergeRequest?.title,
    url: mergeRequest?.webUrl,
  };
};

/**
 * Reads a window of the user's own GitLab activity and returns it as events to store.
 *
 * Only activity about a merge request is kept. An issue comment or a membership change says nothing
 * about where the time went, and the events endpoint reports plenty of both.
 *
 * The result is safe to re-collect: `dedupeKeyOf` keys each event by GitLab's own id, so a run that
 * overlaps the last one appends nothing twice. That is what lets the window be as wide as it needs to
 * be after the app was closed for a week.
 */
export const collectGitLabEvents$ = (options: GitLabCollectOptions): Observable<GitLabCollection> =>
  fetchGitLabEvents$({
    transport: options.transport,
    credentials: options.credentials,
    from: options.from,
    to: options.to,
    paging: options.paging,
  }).pipe(
    concatMap((all) => {
      const events = all.filter((event) => !!event.mergeRequestIid);

      if (events.length === 0) return of<GitLabCollection>({ events: [], failures: [] });

      return resolveMergeRequests$(options, events).pipe(
        map((resolved): GitLabCollection => ({
          events: events
            .map((event) => toCollectedEvent({ event, mergeRequest: resolved.merged.get(keyOf(event)) }))
            .sort((a, b) => a.at.getTime() - b.at.getTime()),
          failures: resolved.failures,
        })),
      );
    }),
  );
