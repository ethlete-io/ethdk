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
  keepPublicAgentPrompts,
  parseClaudeCodeSessionLog,
  parseCodexSessionLog,
  pathIsUnder,
  resyncAgentSessionCursors,
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
 * Polls one agent's session logs and stores what they gained since the last run.
 *
 * A run reads the cursors, collects from every log the host lists, and writes the events and the moved
 * cursors back in one transaction. Ticks arriving while a run is in flight are dropped rather than
 * queued, so a first run over a machine's whole log history cannot stack up behind itself.
 *
 * One collector per agent, because one agent is one log format and one set of cursors.
 */
const createAgentSessionCollector = (source: AgentLogSource) => {
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
   * Paths whose logs the next run has to read again, from a link the user has just made.
   *
   * The rewind is applied inside the run rather than written to the store when it is asked for. A poll
   * already in flight persists the cursors it read at the end of its own transaction, and those would
   * be written over a rewind made in the meantime — the logs would then never be re-read.
   */
  let pendingResync: string[] = [];
  const resyncAsked$ = new Subject<void>();

  /**
   * Two filters, and they answer different questions. The project link asks whether the checkout is one
   * this machine bills at all — a session Tempo could never take a worklog for is stored nowhere. An
   * exclusion rule then title-matches what is left, because an agent session is named after the work and
   * the work is sometimes what the rule is there to keep out.
   *
   * A typed prompt answers the first question differently: it is presence rather than billable work, so
   * it is kept for an unlinked checkout and dropped only for a private one. See ADR 0006.
   *
   * The cursors move either way: the line was read, and re-reading it would only drop it again.
   */
  const persist$ = (collection: AgentSessionCollection, startedAt: Date): Observable<AgentSessionCollection> => {
    const links = settings.settings().projectLinks;
    const linked = keepLinkedAgentSessions({ events: collection.events, links });
    const linkedUsage = keepLinkedAgentSessions({ events: collection.usage, links });
    const prompts = keepPublicAgentPrompts({ events: collection.prompts, links });

    const { kept, excluded } = applyExclusionRules({
      events: [...linked.kept, ...linkedUsage.kept, ...prompts],
      rules: effectiveExclusionRules(settings.settings()),
    });

    return ports.events.appendWithCursors$({ events: kept, cursors: collection.cursors, pass: source.pass }).pipe(
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

  /**
   * A run reads every log again once a rewind is pending, because `modifiedAfter` skips the logs the
   * agent has not touched since the last run — which is most of them, and all of the old ones.
   */
  const collect$ = (): Observable<AgentSessionCollection> =>
    defer(() => {
      const startedAt = new Date();
      const resyncPaths = pendingResync;

      pendingResync = [];
      isCollecting.set(true);

      return settings.ready$.pipe(
        concatMap(() => ports.events.cursors$(source.pass)),
        map((cursors) => (resyncPaths.length ? resyncAgentSessionCursors({ cursors, paths: resyncPaths }) : cursors)),
        switchMap((cursors) =>
          collectAgentSessions$({
            parser: source.parser,
            reader: source.readerOf(ports),
            cursors,
            modifiedAfter: resyncPaths.length ? undefined : modifiedAfter,
          }),
        ),
        switchMap((collection) => persist$(collection, startedAt)),
        catchError((error: unknown) => {
          pendingResync = [...new Set([...resyncPaths, ...pendingResync])];
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
        finalize(() => isCollecting.set(false)),
      );
    });

  /**
   * Reads the logs under `paths` again, so the sessions dropped while nothing linked them are stored.
   *
   * The checkouts drop out of `totals().unlinked` straight away: they have their answer now, and the
   * re-read reports whatever is still skipped. A run already in flight finishes first — the next tick
   * picks the rewind up, within one poll interval.
   */
  const resync = (paths: readonly string[]) => {
    const wanted = paths.map((path) => path.trim()).filter(Boolean);

    if (!wanted.length) return;

    pendingResync = [...new Set([...pendingResync, ...wanted])];
    totals.update((all) => ({
      ...all,
      unlinked: all.unlinked.filter((entry) => !wanted.some((path) => pathIsUnder(path, entry.cwd))),
    }));
    resyncAsked$.next();
  };

  /** A paused collector reads no log at all: the session titles are the work, and the work is private. */
  merge(timer(0, AGENT_SESSION_POLL_INTERVAL_MS), resyncAsked$)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? EMPTY : collect$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, totals, failure, isCollecting, resync };
};

const AGENT_SESSION_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() =>
  createAgentSessionCollector({
    parser: parseClaudeCodeSessionLog,
    readerOf: (ports) => ports.agentLogs,
    pass: 'agent-session',
  }),
);

const CODEX_SESSION_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() =>
  createAgentSessionCollector({
    parser: parseCodexSessionLog,
    readerOf: (ports) => ports.codexLogs,
    pass: 'codex-session',
  }),
);

export const injectAgentSessionCollector = /* @__PURE__ */ toInjectFn(AGENT_SESSION_COLLECTOR_DEF);

export const injectCodexSessionCollector = /* @__PURE__ */ toInjectFn(CODEX_SESSION_COLLECTOR_DEF);
