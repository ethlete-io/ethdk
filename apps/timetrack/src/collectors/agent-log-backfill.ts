import { computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentLogBackfill,
  AgentSessionCursor,
  CollectedEvent,
  TimetrackProjectLink,
  applyExclusionRules,
  backfillAgentLogs$,
  effectiveExclusionRules,
  keepLinkedAgentSessions,
  keepPublicAgentPrompts,
  parseClaudeCodeSessionLog,
  parseCodexSessionLog,
  rewindAgentBackfillCursors,
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
import { AgentLogSource } from './agent-log-source';

/**
 * Short, because the pass has an end: it reads a handful of logs per run and stops for good once every
 * log has been read. A machine with hundreds of them is filled in in minutes rather than in days.
 */
export const AGENT_LOG_BACKFILL_POLL_INTERVAL_MS = 5_000;

export type AgentLogBackfillRun = {
  at: Date;
  /** Logs read to their end by this run. */
  logs: number;
  /** Events the run stored: the turns' spend for one pass, the typed prompts for the other. */
  stored: number;
  unparsedLines: number;
};

type Rewound = { rewound: AgentSessionCursor[]; cursors: AgentSessionCursor[] };

/**
 * Which of a log's keyed events one pass stores, and under which filter.
 *
 * Spend needs a project link, because a turn in a checkout no project covers is time Tempo could never
 * take. A prompt needs none: it says a person was at the keyboard, and an unlinked day still happened.
 */
type BackfillKeep = (options: { result: AgentLogBackfill; links: readonly TimetrackProjectLink[] }) => CollectedEvent[];

const keepSpend: BackfillKeep = ({ result, links }) => keepLinkedAgentSessions({ events: result.usage, links }).kept;

const keepPrompts: BackfillKeep = ({ result, links }) => keepPublicAgentPrompts({ events: result.prompts, links });

/**
 * Reads one kind of keyed event out of one agent's logs, the ones its session collector had already
 * read past.
 *
 * Both the token counts and the typed prompts were collected only after months of logs had been read,
 * so every stored day before that shows neither. This fills them in: it reads each log once from the
 * top, appends only what `keep` selects, and never touches the collector's own cursor — an activity
 * sample has no dedupe key, so a re-read would store every one of them a second time. See ADR 0003.
 *
 * The pass converges and then stops. Everything a log gains after its one read is the session
 * collector's to store, because that collector reports both as it goes.
 */
const createAgentLogBackfill = (source: AgentLogSource, keep: BackfillKeep) => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<AgentLogBackfillRun | null>(null);
  const remaining = signal<number | null>(null);
  const excluded = signal(0);
  const failure = signal<string | null>(null);
  const isRunning = signal(false);

  /** Nothing is left to read, so the timer stops doing work. A re-sync is what starts it again. */
  const isDone = computed(() => remaining() === 0);

  let pendingRewind: string[] = [];
  const rewindAsked$ = new Subject<void>();

  /**
   * The same filters the session collector applies, and for the same reasons: `keep` answers whether a
   * checkout's events are stored at all, and an exclusion rule then denies what is left.
   *
   * The rewound cursors are written together with the ones the run produced. A rewound log the run did
   * not reach has to keep its cleared cursor in the store, or the next run would skip it again.
   */
  const persist$ = (options: {
    result: AgentLogBackfill;
    rewound: AgentSessionCursor[];
    startedAt: Date;
  }): Observable<AgentLogBackfill> => {
    const { result, rewound, startedAt } = options;
    const wanted = keep({ result, links: settings.settings().projectLinks });
    const denied = applyExclusionRules({ events: wanted, rules: effectiveExclusionRules(settings.settings()) });

    return ports.events
      .appendWithCursors$({
        events: denied.kept,
        cursors: [...rewound, ...result.cursors],
        pass: source.pass,
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
            stored: denied.kept.length,
            unparsedLines: result.unparsedLines,
          });
        }),
      );
  };

  const rewind = (cursors: AgentSessionCursor[], paths: string[]): Rewound => {
    if (!paths.length) return { rewound: [], cursors };

    const rewound = rewindAgentBackfillCursors({ cursors, paths });
    const byId = new Map(rewound.map((cursor) => [cursor.id, cursor]));

    return { rewound, cursors: cursors.map((cursor) => byId.get(cursor.id) ?? cursor) };
  };

  const run$ = (): Observable<AgentLogBackfill> =>
    defer(() => {
      const startedAt = new Date();
      const paths = pendingRewind;

      pendingRewind = [];
      isRunning.set(true);

      return settings.ready$.pipe(
        concatMap(() => ports.events.cursors$(source.pass)),
        map((cursors) => rewind(cursors, paths)),
        switchMap((state) =>
          backfillAgentLogs$({
            parser: source.parser,
            reader: source.readerOf(ports),
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
   * Reads the logs under `paths` again, so what was dropped while nothing linked them is stored.
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
  merge(timer(0, AGENT_LOG_BACKFILL_POLL_INTERVAL_MS), rewindAsked$)
    .pipe(
      exhaustMap(() => (pause.isPaused() || isDone() ? EMPTY : run$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, remaining, excluded, failure, isRunning, isDone, resync };
};

const AGENT_SPEND_BACKFILL_DEF = /* @__PURE__ */ defineRootProvider(() =>
  createAgentLogBackfill(
    { parser: parseClaudeCodeSessionLog, readerOf: (ports) => ports.agentLogs, pass: 'spend' },
    keepSpend,
  ),
);

const CODEX_SPEND_BACKFILL_DEF = /* @__PURE__ */ defineRootProvider(() =>
  createAgentLogBackfill(
    { parser: parseCodexSessionLog, readerOf: (ports) => ports.codexLogs, pass: 'codex-spend' },
    keepSpend,
  ),
);

const AGENT_PROMPT_BACKFILL_DEF = /* @__PURE__ */ defineRootProvider(() =>
  createAgentLogBackfill(
    { parser: parseClaudeCodeSessionLog, readerOf: (ports) => ports.agentLogs, pass: 'prompt' },
    keepPrompts,
  ),
);

const CODEX_PROMPT_BACKFILL_DEF = /* @__PURE__ */ defineRootProvider(() =>
  createAgentLogBackfill(
    { parser: parseCodexSessionLog, readerOf: (ports) => ports.codexLogs, pass: 'codex-prompt' },
    keepPrompts,
  ),
);

export const injectAgentSpendBackfill = /* @__PURE__ */ toInjectFn(AGENT_SPEND_BACKFILL_DEF);

export const injectCodexSpendBackfill = /* @__PURE__ */ toInjectFn(CODEX_SPEND_BACKFILL_DEF);

export const injectAgentPromptBackfill = /* @__PURE__ */ toInjectFn(AGENT_PROMPT_BACKFILL_DEF);

export const injectCodexPromptBackfill = /* @__PURE__ */ toInjectFn(CODEX_PROMPT_BACKFILL_DEF);
