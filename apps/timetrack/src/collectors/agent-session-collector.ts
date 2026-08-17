import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentSessionCollection,
  UnlinkedAgentSessions,
  applyExclusionRules,
  collectAgentSessions$,
  effectiveExclusionRules,
  keepLinkedAgentSessions,
  parseClaudeCodeSessionLog,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  defer,
  exhaustMap,
  finalize,
  map,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { injectHostPorts } from '../host';

export const AGENT_SESSION_POLL_INTERVAL_MS = 60_000;

export type AgentSessionCollectorRun = {
  at: Date;
  events: number;
  unparsedLines: number;
};

/**
 * What a rule has denied since the app started. Session-scoped because nothing stores an exclusion by
 * design — the summary of a denied event is deliberately not persisted.
 */
export type AgentSessionCollectorTotals = {
  since: Date;
  excluded: number;
  /** The checkouts whose sessions were dropped for want of a project link, most samples first. */
  unlinked: UnlinkedAgentSessions[];
};

/** Keeps the most-costly checkouts and drops the tail, so a machine with many repos still reads. */
const UNLINKED_SHOWN = 20;

const mergeUnlinked = (all: UnlinkedAgentSessions[], run: UnlinkedAgentSessions[]) => {
  const merged = new Map(all.map((entry) => [entry.cwd, { ...entry }]));

  for (const entry of run) {
    const seen = merged.get(entry.cwd);

    if (!seen) {
      merged.set(entry.cwd, { ...entry });
      continue;
    }

    seen.events += entry.events;
    if (entry.lastAt > seen.lastAt) seen.lastAt = entry.lastAt;
  }

  return [...merged.values()]
    .sort((a, b) => b.events - a.events || a.cwd.localeCompare(b.cwd))
    .slice(0, UNLINKED_SHOWN);
};

/**
 * Polls the agent's session logs and stores what they gained since the last run.
 *
 * A run reads the cursors, collects from every log the host lists, and writes the events and the moved
 * cursors back in one transaction. Ticks arriving while a run is in flight are dropped rather than
 * queued, so a first run over a machine's whole log history cannot stack up behind itself.
 */
const AGENT_SESSION_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<AgentSessionCollectorRun | null>(null);
  const totals = signal<AgentSessionCollectorTotals>({ since: new Date(), excluded: 0, unlinked: [] });
  const failure = signal<string | null>(null);
  const isCollecting = signal(false);

  /** Only ever moved by a run that persisted, or a failed run would skip the logs it never read. */
  let modifiedAfter: Date | undefined;

  /**
   * Two filters, and they answer different questions. The project link asks whether the checkout is one
   * this machine bills at all — a session Tempo could never take a worklog for is stored nowhere. An
   * exclusion rule then title-matches what is left, because an agent session is named after the work and
   * the work is sometimes what the rule is there to keep out.
   *
   * The cursors move either way: the line was read, and re-reading it would only drop it again.
   */
  const persist$ = (collection: AgentSessionCollection, startedAt: Date): Observable<AgentSessionCollection> => {
    const linked = keepLinkedAgentSessions({
      events: collection.events,
      links: settings.settings().projectLinks,
    });

    const { kept, excluded } = applyExclusionRules({
      events: linked.kept,
      rules: effectiveExclusionRules(settings.settings()),
    });

    return ports.events.appendWithCursors$(kept, collection.cursors).pipe(
      map(() => collection),
      tap(() => {
        modifiedAfter = startedAt;
        failure.set(null);
        lastRun.set({
          at: startedAt,
          events: kept.length,
          unparsedLines: collection.unparsedLines,
        });
        totals.update((all) => ({
          since: all.since,
          excluded: all.excluded + excluded.length,
          unlinked: mergeUnlinked(all.unlinked, linked.unlinked),
        }));
      }),
    );
  };

  const collect$ = (): Observable<AgentSessionCollection> =>
    defer(() => {
      const startedAt = new Date();

      isCollecting.set(true);

      return settings.ready$.pipe(
        concatMap(() => ports.events.cursors$()),
        switchMap((cursors) =>
          collectAgentSessions$({
            parser: parseClaudeCodeSessionLog,
            reader: ports.agentLogs,
            cursors,
            modifiedAfter,
          }),
        ),
        switchMap((collection) => persist$(collection, startedAt)),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
        finalize(() => isCollecting.set(false)),
      );
    });

  /** A paused collector reads no log at all: the session titles are the work, and the work is private. */
  timer(0, AGENT_SESSION_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? EMPTY : collect$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, totals, failure, isCollecting };
});

export const injectAgentSessionCollector = /* @__PURE__ */ toInjectFn(AGENT_SESSION_COLLECTOR_DEF);
