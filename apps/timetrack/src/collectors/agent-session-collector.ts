import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { AgentSessionCollection, collectAgentSessions$, parseClaudeCodeSessionLog } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, defer, exhaustMap, finalize, map, switchMap, tap, timer } from 'rxjs';
import { injectHostPorts } from '../host';

export const AGENT_SESSION_POLL_INTERVAL_MS = 60_000;

export type AgentSessionCollectorRun = {
  at: Date;
  events: number;
  unparsedLines: number;
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
  const lastRun = signal<AgentSessionCollectorRun | null>(null);
  const failure = signal<string | null>(null);
  const isCollecting = signal(false);

  /** Only ever moved by a run that persisted, or a failed run would skip the logs it never read. */
  let modifiedAfter: Date | undefined;

  const persist$ = (collection: AgentSessionCollection, startedAt: Date): Observable<AgentSessionCollection> =>
    ports.events.appendWithCursors$(collection.events, collection.cursors).pipe(
      map(() => collection),
      tap(() => {
        modifiedAfter = startedAt;
        failure.set(null);
        lastRun.set({
          at: startedAt,
          events: collection.events.length,
          unparsedLines: collection.unparsedLines,
        });
      }),
    );

  const collect$ = (): Observable<AgentSessionCollection> =>
    defer(() => {
      const startedAt = new Date();

      isCollecting.set(true);

      return ports.events.cursors$().pipe(
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

  timer(0, AGENT_SESSION_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => collect$()),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, failure, isCollecting };
});

export const injectAgentSessionCollector = /* @__PURE__ */ toInjectFn(AGENT_SESSION_COLLECTOR_DEF);
