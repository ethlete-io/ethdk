import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentSessionCollection,
  applyExclusionRules,
  collectAgentSessions$,
  effectiveExclusionRules,
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
  const totals = signal<AgentSessionCollectorTotals>({ since: new Date(), excluded: 0 });
  const failure = signal<string | null>(null);
  const isCollecting = signal(false);

  /** Only ever moved by a run that persisted, or a failed run would skip the logs it never read. */
  let modifiedAfter: Date | undefined;

  /**
   * A session title is title-matched like a window title — an agent session is named after the work, and
   * the work is sometimes what a rule is there to keep out. The cursors move either way: the line was
   * read, and re-reading it would only deny it again.
   */
  const persist$ = (collection: AgentSessionCollection, startedAt: Date): Observable<AgentSessionCollection> => {
    const { kept, excluded } = applyExclusionRules({
      events: collection.events,
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
        totals.update((all) => ({ since: all.since, excluded: all.excluded + excluded.length }));
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
