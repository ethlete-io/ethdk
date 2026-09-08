import { computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentSessionCursor,
  AgentSpendBackfill,
  applyExclusionRules,
  backfillAgentSpend$,
  effectiveExclusionRules,
  keepLinkedAgentSessions,
  parseClaudeCodeSessionLog,
  rewindAgentSpendCursors,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  defer,
  exhaustMap,
  finalize,
  map,
  merge,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { injectHostPorts } from '../host';

/**
 * Short, because the pass has an end: it reads a handful of logs per run and stops for good once every
 * log has been read. A machine with hundreds of them is filled in in minutes rather than in days.
 */
export const AGENT_SPEND_BACKFILL_POLL_INTERVAL_MS = 5_000;

export type AgentSpendBackfillRun = {
  at: Date;
  /** Logs read to their end by this run. */
  logs: number;
  /** Turns whose spend the run stored. */
  turns: number;
  unparsedLines: number;
};

type Rewound = { rewound: AgentSessionCursor[]; cursors: AgentSessionCursor[] };

/**
 * Reads the token spend out of the agent logs the session collector had already read past.
 *
 * Spend collection started after months of logs had been read, so every stored day before it shows
 * zero. This fills them in: it reads each log once from the top, appends only the token counts, and
 * never touches the collector's own cursor — an activity sample has no dedupe key, so a re-read would
 * store every one of them a second time. See ADR 0003.
 *
 * The pass converges and then stops. Everything a log gains after its one read is the session
 * collector's to store, because that collector already reports spend as it goes.
 */
const AGENT_SPEND_BACKFILL_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<AgentSpendBackfillRun | null>(null);
  const remaining = signal<number | null>(null);
  const excluded = signal(0);
  const failure = signal<string | null>(null);
  const isRunning = signal(false);

  /** Nothing is left to read, so the timer stops doing work. A re-sync is what starts it again. */
  const isDone = computed(() => remaining() === 0);

  let pendingRewind: string[] = [];
  const rewindAsked$ = new Subject<void>();

  /**
   * The same two filters the session collector applies, and for the same reasons: a checkout no project
   * link covers is time Tempo could never take, and an exclusion rule then denies what is left.
   *
   * The rewound cursors are written together with the ones the run produced. A rewound log the run did
   * not reach has to keep its cleared cursor in the store, or the next run would skip it again.
   */
  const persist$ = (options: {
    result: AgentSpendBackfill;
    rewound: AgentSessionCursor[];
    startedAt: Date;
  }): Observable<AgentSpendBackfill> => {
    const { result, rewound, startedAt } = options;
    const linked = keepLinkedAgentSessions({ events: result.usage, links: settings.settings().projectLinks });
    const denied = applyExclusionRules({ events: linked.kept, rules: effectiveExclusionRules(settings.settings()) });

    return ports.events
      .appendWithCursors$({
        events: denied.kept,
        cursors: [...rewound, ...result.cursors],
        pass: 'spend',
      })
      .pipe(
        map(() => result),
        tap(() => {
          failure.set(null);
          remaining.set(result.remaining);
          excluded.update((all) => all + denied.excluded.length);
          lastRun.set({
            at: startedAt,
            logs: result.cursors.length,
            turns: denied.kept.length,
            unparsedLines: result.unparsedLines,
          });
        }),
      );
  };

  const rewind = (cursors: AgentSessionCursor[], paths: string[]): Rewound => {
    if (!paths.length) return { rewound: [], cursors };

    const rewound = rewindAgentSpendCursors({ cursors, paths });
    const byId = new Map(rewound.map((cursor) => [cursor.id, cursor]));

    return { rewound, cursors: cursors.map((cursor) => byId.get(cursor.id) ?? cursor) };
  };

  const run$ = (): Observable<AgentSpendBackfill> =>
    defer(() => {
      const startedAt = new Date();
      const paths = pendingRewind;

      pendingRewind = [];
      isRunning.set(true);

      return settings.ready$.pipe(
        concatMap(() => ports.events.cursors$('spend')),
        map((cursors) => rewind(cursors, paths)),
        switchMap((state) =>
          backfillAgentSpend$({
            parser: parseClaudeCodeSessionLog,
            reader: ports.agentLogs,
            cursors: state.cursors,
          }).pipe(switchMap((result) => persist$({ result, rewound: state.rewound, startedAt }))),
        ),
        catchError((error: unknown) => {
          pendingRewind = [...new Set([...paths, ...pendingRewind])];
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
        finalize(() => isRunning.set(false)),
      );
    });

  /**
   * Reads the logs under `paths` again, so the spend dropped while nothing linked them is stored.
   *
   * `remaining` goes back to unknown at once, which is what restarts a pass that had converged.
   */
  const resync = (paths: readonly string[]) => {
    const wanted = paths.map((path) => path.trim()).filter(Boolean);

    if (!wanted.length) return;

    pendingRewind = [...new Set([...pendingRewind, ...wanted])];
    remaining.set(null);
    rewindAsked$.next();
  };

  /** Paused means no log is read at all, on the same rule the session collector follows. */
  merge(timer(0, AGENT_SPEND_BACKFILL_POLL_INTERVAL_MS), rewindAsked$)
    .pipe(
      exhaustMap(() => (pause.isPaused() || isDone() ? EMPTY : run$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, remaining, excluded, failure, isRunning, isDone, resync };
});

export const injectAgentSpendBackfill = /* @__PURE__ */ toInjectFn(AGENT_SPEND_BACKFILL_DEF);
