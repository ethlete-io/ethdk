import { DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AutoModeAnswer,
  AutoModeDispute,
  AttributionRule,
  withAutoModeRowNames,
  withAutoModeDisputeResolutions,
  AttributionTarget,
  ClosedTimerRun,
  CollectedEvent,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  InferredAttribution,
  ManualRow,
  ReviewedRow,
  SyncedWorklog,
  TempoDayCoverage,
  TimeWindow,
  TimerRun,
  UnnamedContext,
  addManualRow,
  agedNamings,
  classifyCalls,
  closeTimerRun,
  buildRows,
  breaksBetweenRows,
  coveredMsOf,
  dayBoundaryOf,
  effectiveExclusionRules,
  mergeDayEvents,
  receivedEventsOf,
  fetchJiraIssueTouchedAt$,
  fetchTempoDayCoverage$,
  gitFlowConfigFor,
  clearStatements,
  deleteStatement,
  hideRow,
  localDayKey,
  localDayRange,
  pinnedOntoDay,
  matchAttributionRule,
  callBehindRow,
  callLabel,
  countsAsWorkPatternOf,
  callRowSnipAt,
  endRowAt,
  followCallAgain,
  isEndedCallRow,
  isLiveCallRow,
  meetingBehindRow,
  mergeRows,
  moveRowBoundary,
  namedIssueKeys,
  offTopicRests,
  openStandIn,
  offeredStandIns,
  pauseWindows,
  pausedMs,
  projectKeyFor,
  readHeadBranches$,
  unbranchedCheckouts,
  readJiraCredentials$,
  readTempoCredentials$,
  reasoningCandidates,
  reasoningOptionsOf,
  RepoNamingOffer,
  reasoningPlan,
  repoNamingDecisions,
  removeManualRow,
  resetRow,
  reviewDay,
  settingsOnDay,
  withFrozenRows,
  runReasoning$,
  setRowDescription,
  setRowDuration,
  setRowIssue,
  setRowRange,
  setRowStandIn,
  setRowState,
  shiftDayKey,
  showRow,
  writeStatement,
  splitRow,
  standInNameFor,
  statedPresence,
  agentTurnsOf,
  agentUsageWithin,
  streamDay,
  TokenUsage,
  unnamedContexts,
  windowsMs,
  ledgerEntriesForRange$,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  concatMap,
  debounceTime,
  defer,
  groupBy,
  map,
  mergeMap,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  injectAgentPromptBackfill,
  injectAgentSessionCollector,
  injectAgentSpendBackfill,
  injectCallCollector,
  injectCodexPromptBackfill,
  injectCodexSessionCollector,
  injectCodexSpendBackfill,
  injectGitCollector,
  injectWindowCollector,
} from '../../collectors';
import { injectLaneIssueHistory } from '../jira';
import { HostReceivedRange, NOTHING_RECEIVED, TranscriptChunk, injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectEpicSiblings } from '../naming/epic-siblings';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { dayRowsOptionsOf, streamDayOptionsOf } from '../stream-day-options';
import { heardChunksOf, transcriptBetween$ } from '../transcript-chunks';
import { injectTimer } from '../timer';
import { readViewState, rememberViewState } from '../view-state';
import { injectCheckoutDependencies } from '../checkout-dependencies';
import { injectProjectLinks } from '../project-links';
import { runStandInPass } from '../stand-ins/stand-in-pass';

/** How long typing settles before a day's edits are written. */
const SAVE_DEBOUNCE_MS = 300;

const NO_HEAD_BRANCHES: Readonly<Record<string, string>> = {};

/** A load tagged with the day it was asked for, so a stale answer is recognised rather than shown. */
type Loaded<T> = { key: string; value: T | null; failure: string | null };

/** One day's raw inputs, loaded together so a half-loaded day is never correlated. */
type DayEvidence = {
  events: CollectedEvent[];
  received: HostReceivedRange;
  transcript: TranscriptChunk[];
  runs: ClosedTimerRun[];
  pauses: TimeWindow[];
  /** The instant the day is read through, for anything that has to cut off a stretch still open. */
  through: Date;
  now?: Date;
};

/**
 * Cuts an open run off at now, or at the end of the day being read, whichever comes first.
 *
 * Closing it at the day's end would hand a timer that is still going every hour left until midnight.
 * On a past day the end *is* the honest maximum - and a run left open across midnight lands in the
 * unobserved-timer warning, which is where a forgotten timer belongs.
 */
const closedThrough = (runs: TimerRun[], dayEnd: Date): ClosedTimerRun[] => {
  const at = new Date(Math.min(Date.now(), dayEnd.getTime()));

  return runs.map((run) => closeTimerRun(run, at));
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const loadedFor = <T>(options: { key: string; load$: Observable<T> }): Observable<Loaded<T>> =>
  options.load$.pipe(
    map((value): Loaded<T> => ({ key: options.key, value, failure: null })),
    catchError((error: unknown) => of<Loaded<T>>({ key: options.key, value: null, failure: messageOf(error) })),
  );

/**
 * One day of work as the review UI reads it: the engine re-run over the day's stored events, with the
 * reviewer's own edits on top.
 *
 * The engine's rows are stored only once Tempo holds the finished day. Until then a day whose evidence
 * grew since it was reviewed shows the new evidence, and the reviewer's decisions still win over it.
 */
const DAY_REVIEW_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const laneIssues = injectLaneIssueHistory();
  const destroyRef = inject(DestroyRef);
  const windows = injectWindowCollector();
  const callSource = injectCallCollector();
  const agentSessions = injectAgentSessionCollector();
  const codexSessions = injectCodexSessionCollector();
  const spend = injectAgentSpendBackfill();
  const codexSpend = injectCodexSpendBackfill();
  const prompts = injectAgentPromptBackfill();
  const codexPrompts = injectCodexPromptBackfill();
  const git = injectGitCollector();
  const dependencies = injectCheckoutDependencies();
  const projectLinks = injectProjectLinks();
  const timers = injectTimer();
  const settings = injectTimetrackSettings();
  const recurring = injectRecurringPatterns();
  const epics = injectEpicSiblings();

  const boundary = computed(() => dayBoundaryOf(settings.settings()));
  const day = signal(readViewState().day ?? localDayKey(new Date(), dayBoundaryOf(settings.settings())));
  const targetMs = computed(() => settings.settings().dayTargetMs);
  const local = signal<Record<string, DayReviewEdits>>({});
  const saves$ = new Subject<{ key: string; edits: DayReviewEdits }>();
  const saved$ = new Subject<string>();

  effect(() => epics.watch(day()));

  const probe = computed(() => ({
    key: day(),
    windows: windows.lastRun(),
    calls: callSource.lastRun(),
    sessions: agentSessions.lastRun(),
    codexSessions: codexSessions.lastRun(),
    spend: spend.lastRun(),
    codexSpend: codexSpend.lastRun(),
    prompts: prompts.lastRun(),
    codexPrompts: codexPrompts.lastRun(),
    git: git.lastRun(),
    timers: timers.revision(),
  }));

  const loadedDay = toSignal(
    toObservable(probe).pipe(
      switchMap(({ key }) => {
        const { from, to } = localDayRange(key, boundary());
        const through = new Date(Math.min(Date.now(), to.getTime()));

        return loadedFor<DayEvidence>({
          key,
          load$: combineLatest({
            events: ports.events.eventsBetween$(from, to),
            runs: ports.timers.runsBetween$(from, to).pipe(map((runs) => closedThrough(runs, to))),
            received: ports.peers.receivedBetween$(from, to).pipe(catchError(() => of(NOTHING_RECEIVED))),
            transcript: transcriptBetween$({ ports, from, to }),
          }).pipe(
            map((loaded) => ({
              ...loaded,
              through,
              now: through < to ? through : undefined,
              // The same rule as an open timer run, for the same reason: a pause taken this morning
              // must not claim every hour left until midnight.
              pauses: pauseWindows({ events: loaded.events, window: { from, to }, through }),
            })),
          ),
        });
      }),
      startWith(null),
    ),
    { initialValue: null },
  );

  const loadedEdits = toSignal(
    toObservable(day).pipe(
      switchMap((key) => loadedFor<DayReviewEdits | null>({ key, load$: ports.review.editsFor$(key) })),
      startWith(null),
    ),
    { initialValue: null },
  );

  /**
   * What Tempo already holds for the day, asked of Tempo every time a day is opened.
   *
   * A day logged by hand proposes nothing at all — every row is reduced to zero by the same foreign
   * time — so without this the day compares `0m` against the target and reports a finished day as
   * short. What is read is stored, which is also what lets the week view and the reminder answer with
   * no token and no network.
   */
  const readCoverage$ = (key: string): Observable<TempoDayCoverage | null> =>
    combineLatest({
      jira: readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }),
      tempo: readTempoCredentials$({ secrets: ports.secrets }),
    }).pipe(
      switchMap(({ jira, tempo }) =>
        jira && tempo
          ? fetchTempoDayCoverage$({
              transport: ports.transport,
              jira,
              tempo,
              ledger: ports.ledger,
              day: key,
              boundary: boundary(),
            }).pipe(
              concatMap((read) =>
                ports.coverage.save$(read).pipe(
                  catchError(() => of(undefined)),
                  map(() => read),
                ),
              ),
            )
          : of(null),
      ),
      // Tempo is an extra, not the day. A missing token, an expired one or an offline machine leaves
      // the day reading exactly as it did before this was here.
      catchError(() => of(null)),
    );

  const loadedCoverage = toSignal(
    toObservable(day).pipe(
      switchMap((key) =>
        loadedFor<TempoDayCoverage | null>({
          key,
          load$: ports.coverage.forDay$(key).pipe(
            catchError(() => of(null)),
            // The stored record is the answer only when Tempo gives none: no token, or no network.
            switchMap((stored) => readCoverage$(key).pipe(map((read) => read ?? stored))),
          ),
        }),
      ),
      startWith(null),
    ),
    { initialValue: null },
  );

  const coverage = computed(() => {
    const loaded = loadedCoverage();

    return loaded?.key === day() ? loaded.value : null;
  });

  /**
   * When Jira last recorded a change on each ticket the remembered namings point at.
   *
   * Read against the key list rather than against the day: the store changes when the user answers a
   * band, and stepping from one day to the next changes nothing about it.
   */
  const namedKeys = computed(() =>
    namedIssueKeys({
      namings: settings.settings().meetingNamings,
      callNamings: settings.settings().callNamings,
    }).join(','),
  );

  const touchedAt = toSignal(
    toObservable(namedKeys).pipe(
      switchMap((keys) =>
        keys
          ? readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
              switchMap((jira) =>
                jira
                  ? fetchJiraIssueTouchedAt$({ transport: ports.transport, credentials: jira, keys: keys.split(',') })
                  : of(new Map<string, Date>()),
              ),
              // Jira is an extra, not the day. A missing token or an offline machine leaves the day
              // reading exactly as it did before this was here.
              catchError(() => of(new Map<string, Date>())),
            )
          : of(new Map<string, Date>()),
      ),
    ),
    { initialValue: new Map<string, Date>() },
  );

  const agedRecords = computed(() =>
    agedNamings({
      namings: settings.settings().meetingNamings,
      callNamings: settings.settings().callNamings,
      touchedAt: touchedAt(),
      now: new Date(),
    }),
  );

  const evidenceLoad = computed(() => {
    const loaded = loadedDay();

    return loaded?.key === day() ? loaded : null;
  });

  const editsLoad = computed(() => {
    const loaded = loadedEdits();

    return loaded?.key === day() ? loaded : null;
  });

  const evidence = computed(() => evidenceLoad()?.value ?? null);

  /**
   * The day's calls, classified here rather than in the loader: the rules are a setting, so editing one
   * has to re-read the day the reviewer is looking at without waiting for it to be loaded again.
   */
  const calls = computed(() => {
    const collected = evidence();

    return collected
      ? classifyCalls({
          events: collected.events,
          rules: settings.settings().callRules,
          until: collected.through,
        })
      : [];
  });
  const edits = computed(() =>
    pinnedOntoDay({
      edits: local()[day()] ?? editsLoad()?.value ?? EMPTY_DAY_REVIEW_EDITS,
      day: day(),
      boundary: boundary(),
    }),
  );

  const daySettings = computed(() => settingsOnDay({ settings: settings.settings(), day: day() }));

  const rowOptions = computed(() => ({
    ...dayRowsOptionsOf({
      settings: daySettings(),
      patterns: recurring.patterns(),
      epics: epics.optionsFor(day()),
      through: evidence()?.through,
    }),
    timerRuns: evidence()?.runs ?? [],
    pauses: evidence()?.pauses ?? [],
  }));

  const merged = computed(() => {
    const collected = evidence();

    return collected
      ? mergeDayEvents({
          local: collected.events,
          received: collected.received,
          keys: collected.received.ownRepoKeys,
          rules: effectiveExclusionRules(settings.settings()),
        })
      : null;
  });

  /**
   * The day as its streams, with no model answer in it: presence, concurrency, spend, the blocks the
   * rows are built from, and the deterministic rows themselves.
   *
   * This is what the naming card and the provider's own payload are derived from, so asking a second
   * time asks the same question — an answer that fed back into its own input would narrow every later
   * run.
   */
  const streamed = computed(() => {
    const collected = evidence();
    const discovery = git.discovery();

    const events = merged();

    return collected && events && discovery && !settings.isLoading() && editsReady()
      ? streamDay({
          events,
          options: streamDayOptionsOf({
            repoRoots: discovery.repos,
            settings: daySettings(),
            links: projectLinks(),
            worktrees: git.worktrees(),
            dependencies: dependencies(),
            patterns: recurring.patterns(),
            epics: epics.optionsFor(day()),
            windowsSeenThroughMs: windows.lastRun()?.at.getTime(),
            headBranches: headBranches(),
            now: collected.now,
            rows: rowOptions(),
            heard: heardChunksOf(collected.transcript),
          }),
        })
      : null;
  });

  const deterministicRows = computed(() => edits().frozenRows ?? streamed()?.rows ?? null);

  const unnamed = computed(() => unnamedContexts({ unattributed: deterministicRows()?.unattributed ?? [] }));

  /**
   * The standing rule that already covers a context, for the naming card to say so.
   *
   * A donating context stays on the list on a day with no attributed work to join, because there is
   * nothing to hand its time to — and without this the card looks exactly as it did before the user
   * answered, which reads as a button that did nothing.
   */
  const rulesByContext = computed(() => {
    const rules = settings.settings().attributionRules;
    const found = new Map<string, AttributionRule>();

    for (const context of unnamed()) {
      const match = matchAttributionRule({ context: context.context, rules });

      if (match) found.set(context.id, match.rule);
    }

    return found;
  });

  /**
   * The checkouts the user turned an offer down for. It lasts the session and no longer: a dismissal
   * is not a decision about the work, and writing one into the settings would put a standing answer
   * there that the user never gave.
   */
  const declinedOffers = signal<readonly string[]>([]);

  /**
   * The checkout-wide answer the user's own record already contains, for the checkouts the day saw.
   *
   * It reads every checkout rather than only the unnamed ones, because the case it exists for is a
   * checkout whose time a donating rule hands away: nothing is left unnamed, and the day would never
   * ask. It is read rather than learnt — the project link and the Tempo history are both decisions the
   * user made, and this only states what they add up to. Accepting one is still a click. See
   * `repoNamingOffers`.
   */
  const namingDecisions = computed(() =>
    repoNamingDecisions({
      checkouts: (streamed()?.streams ?? []).flatMap((stream) =>
        stream.repoPath ? [{ repoPath: stream.repoPath, branches: stream.branches, observedMs: stream.engagedMs }] : [],
      ),
      links: projectLinks(),
      rules: settings.settings().attributionRules,
      worklogs: recurring.worklogs(),
      loggedIssues: recurring.loggedIssues(),
    }),
  );

  const namingOffers = computed(() =>
    namingDecisions().offers.filter((offer) => !declinedOffers().includes(offer.repoPath)),
  );

  const plan = computed(() => {
    const rows = deterministicRows();

    return rows
      ? reasoningPlan({
          contexts: unnamed(),
          unattributed: rows.unattributed,
          maskedNames: settings.settings().reasoning.maskedNames,
          candidates: reasoningCandidates({ proposals: rows.proposals, logged: recurring.loggedIssues() }),
        })
      : null;
  });

  const answers = signal<Record<string, InferredAttribution[]>>({});
  /** The last run that produced nothing, tagged with the question it failed on. One run is in flight. */
  const failure = signal<{ hash: string; message: string } | null>(null);
  const asking = signal(false);

  /** Keyed by payload rather than by day: a day whose evidence grew is a new question, and only then. */
  const inferred = computed(() => answers()[plan()?.hash ?? ''] ?? []);

  /**
   * The same day with the provider's answers in it, rebuilt from the blocks the stream pass already
   * produced rather than by reading the day a second time. Only the ladder changes, so re-running the
   * whole of `streamDay` for it would recompute presence, concurrency and spend to the same numbers.
   */
  const reasonedRows = computed(() => {
    const current = streamed();
    const collected = evidence();
    const proposed = inferred();

    if (!current || !collected) return null;

    const frozen = edits().frozenRows;

    if (frozen) return frozen;
    if (!proposed.length) return current.rows;

    const events = merged() ?? collected.events;

    return buildRows({
      blocks: current.blocks,
      events,
      links: projectLinks(),
      calls: calls(),
      breaks: current.breaks,
      inferred: proposed,
      ...rowOptions(),
      received: receivedEventsOf(events),
      peerLanes: current.peerLanes,
    });
  });

  /** The checkouts the day named no branch for: no commit, no branch switch and no agent session. */
  const unbranched = computed(() => {
    const current = streamed();

    if (!current) return null;

    return { day: day(), at: localDayRange(day(), boundary()).to, repoPaths: unbranchedCheckouts(current.streams) };
  });

  const heldHeads = signal<{ day: string; branches: Readonly<Record<string, string>>; asked: ReadonlySet<string> }>({
    day: '',
    branches: {},
    asked: new Set(),
  });

  /**
   * Each checkout is asked once per day and the answer is kept: the day is streamed again with it, which
   * takes the checkout off the unbranched list, and dropping the answer then would stream it branchless
   * again.
   */
  toObservable(unbranched)
    .pipe(
      concatMap((ask) =>
        defer(() => {
          const held = heldHeads();
          const asked = held.day === ask?.day ? held.asked : new Set<string>();
          const missing = ask?.repoPaths.filter((repoPath) => !asked.has(repoPath)) ?? [];

          if (!ask || !missing.length) return EMPTY;

          return readHeadBranches$({ processes: ports.processes, repoPaths: missing, at: ask.at }).pipe(
            catchError(() => of<Record<string, string>>({})),
            tap((found) =>
              heldHeads.update((current) => {
                const base = current.day === ask.day ? current : { branches: {}, asked: new Set<string>() };

                return {
                  day: ask.day,
                  branches: { ...base.branches, ...found },
                  asked: new Set([...base.asked, ...missing]),
                };
              }),
            ),
          );
        }),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  /**
   * The branch each of those checkouts was on that day, from its reflog. It resolves after the day
   * does, so a slow repository delays the branch on one line and never the day's numbers.
   */
  const headBranches = computed(() => {
    const held = heldHeads();

    return held.day === day() ? held.branches : NO_HEAD_BRANCHES;
  });

  const isToday = computed(() => day() === localDayKey(new Date(), boundary()));

  const review = computed(() => {
    const rows = reasonedRows();

    return rows
      ? reviewDay({
          rows,
          edits: edits(),
          cut: rowOptions().cut,
          standIns: daySettings().standIns,
          rules: daySettings().attributionRules,
          check: {
            targetMs: targetMs(),
            coveredMs: coveredMsOf(coverage()),
            pausedMs: pausedMs(evidence()?.pauses ?? []),
            agedNamings: agedRecords(),
            finished: !isToday(),
          },
        })
      : null;
  });

  const rows = computed(() => review()?.rows ?? []);

  const agentUsageByRow = computed(() => {
    const roots = git.discovery()?.repos ?? [];
    const turns = agentTurnsOf({ events: evidence()?.events ?? [], roots });
    const found = new Map<string, TokenUsage & { turns: number }>();

    for (const row of rows()) {
      const usage = agentUsageWithin({ turns, roots, laneKey: row.laneKey, from: row.from, to: row.to });

      if (usage) found.set(row.id, usage);
    }

    return found;
  });
  const hiddenRows = computed(() => review()?.hidden ?? []);
  const statements = computed(() => edits().statements);
  const breaks = computed(() =>
    breaksBetweenRows({
      breaks: streamed()?.breaks ?? [],
      rows: rows(),
      presence: [...(streamed()?.calls ?? []).filter((call) => call.isPresence), ...(evidence()?.runs ?? [])],
      statements: edits().statements,
    }),
  );

  const presentMs = computed(() =>
    windowsMs(statedPresence({ presence: streamed()?.presence ?? [], statements: edits().statements })),
  );

  const concurrency = computed(() => {
    const engagedMs = streamed()?.engagedMs ?? 0;
    const presence = presentMs();

    return presence ? engagedMs / presence : 0;
  });

  /**
   * Opens a placeholder for a linked checkout the day could not name, and records the day on every
   * placeholder the day's rows already carry.
   *
   * Neither is asked for. A checkout Jira holds no ticket for produces `Not yet named` bands day after
   * day, and a question the user has to go looking for is a question nobody answers — so the app
   * writes the placeholder and the user resolves it to a real issue later.
   *
   * It waits for the day's own evidence, because a name drafted from half a day is a name the user has
   * to correct. Both writes are what stop it reading its own write back: the rule takes the checkout
   * out of `unnamed()`, and the day list is written only when the day is missing from it.
   *
   * It waits for the Tempo history too. A naming offer is read out of it, it arrives long after the
   * day does, and a read taken while the request is out reports no history at all — so a pass that ran
   * first would open a placeholder for a checkout the user's own record already names an issue for.
   *
   * The epic rung is the same case and ranks above the stand-in rungs: a placeholder opened while its
   * read is still out would take the checkout the sibling's parent was about to name.
   */
  effect(() => {
    const load = evidenceLoad();
    const deterministic = deterministicRows();

    if (!load || load.failure || !deterministic || recurring.state().state === 'loading') return;
    if (!epics.settledFor(day())) return;

    runStandInPass({
      settings,
      day: day(),
      contexts: unnamed(),
      unattributed: deterministic.unattributed,
      events: load.value?.events ?? [],
      links: projectLinks(),
      repoRoots: git.discovery()?.repos,
      offeredCheckouts: namingOffers().map((offer) => offer.repoPath),
      standInIds: rows().flatMap((row) => (row.standInId ? [row.standInId] : [])),
      streams: streamed()?.streams ?? [],
    });
  });

  // The whole day's ledger, not the rows': an entry no row claims is a worklog the sync has to delete,
  // and a read by row id can never return it. The failure stays inside the switch, or one failed read
  // would end the subscription and no later day would be read at all.
  const loadedLedger = toSignal(
    toObservable(day).pipe(
      switchMap((key) =>
        ledgerEntriesForRange$({ ledger: ports.ledger, day: key, boundary: boundary() }).pipe(
          catchError(() => of<SyncedWorklog[]>([])),
          map((entries) => ({ key, entries })),
        ),
      ),
    ),
    { initialValue: null },
  );

  const ledger = computed(() => {
    const loaded = loadedLedger();

    return loaded?.key === day() ? loaded.entries : [];
  });

  const syncedIds = computed(() => new Set(ledger().map((entry) => entry.proposalId)));

  saves$
    .pipe(
      groupBy((entry) => entry.key),
      mergeMap((perDay) =>
        perDay.pipe(
          debounceTime(SAVE_DEBOUNCE_MS),
          concatMap(({ key, edits: next }) =>
            ports.review.save$(key, next).pipe(
              map(() => key),
              catchError(() => EMPTY),
            ),
          ),
        ),
      ),
      tap((key) => saved$.next(key)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const applyOn = (key: string, next: DayReviewEdits) => {
    local.update((all) => ({ ...all, [key]: next }));
    saves$.next({ key, edits: next });
  };

  const apply = (next: DayReviewEdits) => applyOn(day(), next);

  const editsReady = computed(() => {
    const load = editsLoad();

    return !!load && !load.failure;
  });

  effect(() => {
    const rows = reasonedRows();
    const load = evidenceLoad();
    const loaded = loadedLedger();

    if (!rows || !load || load.failure || !editsReady() || loaded?.key !== day()) return;
    if (recurring.state().state === 'loading' || !epics.settledFor(day())) return;

    const next = withFrozenRows({
      edits: edits(),
      rows,
      ledger: loaded.entries,
      finished: !isToday(),
    });

    if (next) apply(next);
  });

  /**
   * Writes a change onto a day's edits whether or not the day is on screen, so an answer that lands
   * after the user moved on still reaches the day it was asked on.
   */
  const heldEditsOf = (key: string): DayReviewEdits | undefined =>
    key === day() && editsReady() ? edits() : local()[key];

  const changeDay$ = (key: string, change: (edits: DayReviewEdits) => DayReviewEdits): Observable<void> =>
    defer(() => {
      const held = heldEditsOf(key);

      if (held) return of(applyOn(key, change(held)));

      return ports.review
        .editsFor$(key)
        .pipe(map((stored) => applyOn(key, change(local()[key] ?? stored ?? EMPTY_DAY_REVIEW_EDITS))));
    });

  /**
   * Names a row and re-reads what each lane was named with, so the issue just picked for one call is
   * offered to the next call of the same day rather than only after a restart.
   */
  const nameRow = (row: ReviewedRow, issueKey: string) => {
    apply(setRowIssue({ edits: edits(), row, issueKey }));
    laneIssues.reload();
  };

  /**
   * Asks the local agent CLI about the contexts nothing could name.
   *
   * An answer is kept against the payload's own hash, so re-opening the day, or a collector tick that
   * changed nothing about the question, reads the answer back instead of spawning the CLI. A press
   * still runs: the button that offers to ask again is the reviewer saying this answer was not enough,
   * and only `asking` may refuse it — a second CLI while the first is in flight answers the same
   * question twice.
   *
   * A failed run is not kept. Its hash stays unanswered, so the card offers the question again rather
   * than reading an empty answer back as the day's verdict.
   */
  const ask = () => {
    const current = plan();

    if (!current || asking()) return;

    asking.set(true);
    failure.set(null);

    runReasoning$({
      runner: ports.processes,
      plan: current,
      options: reasoningOptionsOf(settings.settings()),
    })
      .pipe(
        tap((outcome) => {
          if (outcome.failure) failure.set({ hash: current.hash, message: outcome.failure });
          else answers.update((all) => ({ ...all, [current.hash]: outcome.answers }));

          asking.set(false);
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const goToDay = (key: string) => {
    day.set(key);
    rememberViewState({ day: key });
  };

  return {
    dayKey: day.asReadonly(),
    /** The day whose edits just reached the store, once per write. */
    saved$: saved$.asObservable(),
    targetMs,
    /** What auto mode asked and answered on the day on screen, or `null` until its edits are read. */
    autoAnswers: computed(() => (editsReady() ? (edits().auto ?? []) : null)),
    /** The stored edits of the day on screen, or `null` until they are read. */
    storedEdits: computed(() => (editsReady() ? edits() : null)),
    heldEditsOf,
    changeDay$,
    /** Whether the reads the stand-in pass waits for all answered, so it has had its turn. */
    namingSettled: computed(
      () => recurring.state().state !== 'loading' && epics.settledFor(day()) && !!git.discovery(),
    ),

    /** Names the unnamed rows of the day on screen with what auto mode found for their context. */
    applyAutoModeNames: (applies: (answer: AutoModeAnswer) => boolean) => {
      const deterministic = deterministicRows();

      if (!editsReady() || !deterministic || !review()) return;

      const current = edits();
      const next = withAutoModeRowNames({
        edits: current,
        rows: rows(),
        unattributed: deterministic.unattributed,
        applies,
      });

      if (next !== current) apply(next);
    },
    applyAutoModeDisputes: (applies: (dispute: AutoModeDispute) => boolean) => {
      if (!editsReady() || !review()) return;

      const current = edits();
      const next = withAutoModeDisputeResolutions({ edits: current, rows: rows(), applies });

      if (next !== current) apply(next);
    },
    rows,
    /** The rows taken off the timeline. Neither written nor unattributed — this is where their time went. */
    hiddenRows,
    /** The day's breaks as the rows leave them, which is the only place a break is drawn. */
    breaks,
    /** What the user said the day's stretches were, newest last. The breaks above already follow them. */
    statements,
    /**
     * How long the user was present, as their statements leave it. The app is a human factor tool, so
     * the number it shows is the one the user believes. `day().presenceMs` is what the collectors
     * measured, and the day's notes keep it beside this one.
     */
    presentMs,
    /** `engagedMs` read against the presence above, so the ratio follows a statement as well. */
    concurrency,
    review,
    /** The day as its streams: presence, concurrency, the agents' spend and the blocks behind the rows. */
    day: streamed,
    /** The branch a checkout the day named none for was on, by checkout path, from its reflog. */
    headBranches,
    isToday,
    /** The agents' tokens inside each row's checkout and range, by row id; a row with none has no entry. */
    agentUsageByRow,
    /** The rows the model's answers are in, which is what the screen draws and the reviewer edits. */
    reasoned: reasonedRows,
    /**
     * The day with no model answer in it, which is what a ticket draft quotes — the same input the
     * unnamed-work card and the reasoning payload are built from. Drafting off `reasoned` would leave
     * a context the provider already named with no evidence to quote at all.
     */
    deterministic: deterministicRows,
    /**
     * The contexts the day could not name an issue for, widest first. In a repository the branch
     * grammar cannot read, this is most of the day, and naming one of them is what turns it into
     * worklogs — here and on every later day the context appears in.
     *
     * A context the provider proposed an issue for stays on this list. Its rows carry the proposal,
     * but the standing answer is still missing, and writing that one down is what stops the day from
     * asking again tomorrow.
     */
    unnamed,
    /** The rule already covering an unnamed context, by context id. */
    rulesByContext,
    /**
     * The checkout-wide answer the user's own record already holds, for the checkouts the day saw.
     * Empty without a Tempo history, which is every machine with no token.
     */
    namingOffers,
    /**
     * Time in a path the user marked private. The day reports it rather than hiding it: a reviewer who
     * cannot see that the app watched has no way to tell a working link from a broken one.
     */
    privateTime: computed(() => deterministicRows()?.private ?? []),
    /** Exactly what a reasoning run would send, for the UI to show before anything leaves the machine. */
    reasoningPayload: computed(() => plan()?.request ?? null),
    /** What the provider proposed, by context id, for the naming card to offer as an answer. */
    inferredByContext: computed(() => new Map(inferred().map((entry) => [entry.contextId, entry]))),
    isAsking: asking.asReadonly(),
    hasAsked: computed(() => {
      const current = plan();

      return !!current && current.hash in answers();
    }),
    /** Why the last run for this question produced nothing, or `null`. The reviewer can press again. */
    askFailure: computed(() => {
      const failed = failure();

      return failed && failed.hash === plan()?.hash ? failed.message : null;
    }),
    /**
     * Whether a run answered this question and named no issue for any context.
     *
     * Without it the card looks exactly as it did before the press, which is the reading the user
     * reported: a model that has no idea and a button that does nothing are the same picture.
     */
    askedInVain: computed(() => {
      const current = plan();

      return !!current && current.hash in answers() && !inferred().length;
    }),
    canAsk: computed(() => settings.settings().reasoning.enabled && (plan()?.request.contexts.length ?? 0) > 0),
    ask,
    /** The day's timed runs, so an unnamed one can be named rather than only warned about. */
    timerRuns: computed(() => evidence()?.runs ?? []),
    openRunId: computed(() => timers.running()?.id ?? null),
    isLoading: computed(() => !evidenceLoad()),
    failure: computed(() => evidenceLoad()?.failure ?? editsLoad()?.failure ?? null),
    /** What Tempo already holds for the day, and when that was read. `null` while it is unknown. */
    coverage,
    /** Rows this app has already written to Tempo, by proposal id. */
    syncedIds,
    /** How many of the day's rows Tempo holds. An entry no row claims is not one — the sync deletes it. */
    syncedRowCount: computed(() => rows().filter((row) => syncedIds().has(row.id)).length),
    goToDay,
    boundary,
    goToToday: () => goToDay(localDayKey(new Date(), boundary())),
    shiftDay: (byDays: number) => goToDay(shiftDayKey(day(), byDays)),

    /**
     * The day's meetings, for the add-entry panel to offer rather than make the user retype one. A
     * meeting the rows already hold is left out: it is already on the day, and offering it again is how
     * one lunch becomes two.
     */
    meetings: computed(() => {
      const claimed = new Set(rows().map((row) => `${row.from.getTime()}|${row.to.getTime()}`));

      return (reasonedRows()?.unobserved ?? []).filter(
        (entry) => !claimed.has(`${entry.event.at.getTime()}|${entry.event.until.getTime()}`),
      );
    }),

    /**
     * Names a row, and remembers the answer for the call behind it, so the same call next week is named
     * without being asked again. A meeting the calendar named is remembered against its series; a call
     * the calendar never held is remembered against the call's own features instead.
     */
    setIssue: (row: ReviewedRow, issueKey: string) => {
      nameRow(row, issueKey);

      if (!issueKey) return;

      const calls = reasonedRows()?.calls ?? [];
      const event = meetingBehindRow({ row, calls });

      if (event) {
        settings.nameMeeting({ event, issueKey });

        return;
      }

      const call = callBehindRow({ row, calls });

      if (call)
        settings.nameCall({
          features: call.features,
          label: callLabel(call.call),
          target: { kind: 'issue', issueKey },
        });
    },
    /**
     * Pins the issue a row already books as the user's own answer, which settles a band two answers
     * disagreed about. Nothing is remembered: the rival answer is the user's too, for its own series.
     */
    keepIssue: (row: ReviewedRow) => {
      if (row.issueKey) nameRow(row, row.issueKey);
    },
    /** The names the user gave work Jira does not hold yet, has not answered and did not hide, newest first. */
    openStandIns: computed(() => offeredStandIns(settings.settings().standIns)),

    /** Every stand-in, resolved ones included, so a band that names one can still show its name. */
    allStandIns: computed(() => settings.settings().standIns),

    /**
     * Names a row with a stand-in, and remembers the answer for a call behind it the way `setIssue`
     * does for a key. The day is written onto the record as well: a resolve names the days it made
     * bookable from that list, and a band named here is one of them.
     */
    setStandIn: (row: ReviewedRow, standInId: string) => {
      apply(setRowStandIn({ edits: edits(), row, standInId }));

      if (!standInId) return;

      settings.markStandInDay({ id: standInId, day: day() });

      const call = callBehindRow({ row, calls: reasonedRows()?.calls ?? [] });

      if (call)
        settings.nameCall({
          features: call.features,
          label: callLabel(call.call),
          target: { kind: 'stand-in', standInId },
        });
    },

    setDescription: (row: ReviewedRow, description: string) =>
      apply(setRowDescription({ edits: edits(), row, description })),
    setDuration: (row: ReviewedRow, durationMs: number) => apply(setRowDuration({ edits: edits(), row, durationMs })),
    setState: (row: ReviewedRow, state: 'accepted' | 'rejected') => apply(setRowState({ edits: edits(), row, state })),
    reset: (row: ReviewedRow) => apply(resetRow({ edits: edits(), row })),
    split: (row: ReviewedRow, at: Date) => apply(splitRow({ edits: edits(), row, at })),
    moveBoundary: (move: { before: ReviewedRow; after: ReviewedRow; at: Date }) =>
      apply(moveRowBoundary({ edits: edits(), ...move })),

    /**
     * Adds a row for work nothing observed — a meeting away from the desk, a phone call, an hour on
     * another machine. It is what the timeline's drag-to-create and the add-entry panel write.
     *
     * A row drawn over a band a rule excluded cuts that band: the minutes are this work now.
     */
    addRow: (row: ManualRow) => apply(addManualRow({ edits: edits(), row, over: rows() })),

    /** Where a dragged row now sits. A move keeps its duration; dragging one end re-reads it. */
    rescheduleRow: (move: { row: ReviewedRow; from: Date; to: Date }) =>
      apply(setRowRange({ edits: edits(), ...move })),

    excludedCallOf: (row: ReviewedRow) =>
      row.excluded && !row.issueKey ? callBehindRow({ row, calls: deterministicRows()?.calls ?? [] })?.call : undefined,

    countCallAsWork: (row: ReviewedRow) => {
      const call = callBehindRow({ row, calls: deterministicRows()?.calls ?? [] })?.call;

      if (call) settings.addCallRule('countsAsWork', countsAsWorkPatternOf(call.appId));
    },

    isLiveCall: (row: ReviewedRow) =>
      isToday() &&
      isLiveCallRow({
        row,
        calls: deterministicRows()?.calls ?? [],
        events: evidence()?.events ?? [],
        edits: edits(),
      }),

    /** Today's rest bands of ended calls that read as the call gone off topic. */
    offTopicRests: computed(() =>
      isToday() && editsReady()
        ? offTopicRests({
            rows: rows(),
            edits: edits(),
            calls: deterministicRows()?.calls ?? [],
            events: evidence()?.events ?? [],
          })
        : [],
    ),

    endRowNow: (row: ReviewedRow) => apply(endRowAt({ edits: edits(), row, at: new Date() })),

    snipAtOf: (row: ReviewedRow) => callRowSnipAt({ row, calls: deterministicRows()?.calls ?? [] }),

    endRowAtSnip: (row: ReviewedRow) =>
      apply(endRowAt({ edits: edits(), row, at: callRowSnipAt({ row, calls: deterministicRows()?.calls ?? [] }) })),

    isEndedCall: (row: ReviewedRow) => isEndedCallRow({ row, calls: deterministicRows()?.calls ?? [], edits: edits() }),

    followCallAgain: (row: ReviewedRow) =>
      apply(followCallAgain({ edits: edits(), row, calls: deterministicRows()?.calls ?? [] })),

    endRowAtCut: (move: { row: ReviewedRow; at: Date }) => apply(endRowAt({ edits: edits(), ...move })),

    /** Takes a hand-written row off the day. An engine proposal is rejected rather than removed. */
    removeRow: (row: ReviewedRow) => apply(removeManualRow({ edits: edits(), row })),

    /** Takes a row off the timeline without throwing it away. `show` is the only way back. */
    hide: (row: ReviewedRow) => apply(hideRow({ edits: edits(), row })),

    /** Puts a hidden row back on the timeline with every other edit it carries intact. */
    show: (row: ReviewedRow) => apply(showRow({ edits: edits(), row })),

    /**
     * Draws a break over a stretch the user says they were away for, whatever the day measured in it.
     * It outranks every rule the day derived, the call guard included.
     */
    stateAway: (window: TimeWindow) => apply(writeStatement({ edits: edits(), kind: 'away', ...window })),

    /** Takes a break off the day: the user was at the machine for the stretch it covered. */
    clearBreak: (window: TimeWindow) => apply(writeStatement({ edits: edits(), kind: 'present', ...window })),

    /** Takes back one statement, so the stretch it covered reads as the day measured it again. */
    takeBackStatement: (id: string) => apply(deleteStatement({ edits: edits(), id })),

    /** Takes back every statement of the day, leaving the rows and their edits alone. */
    resetStatements: () => apply(clearStatements({ edits: edits() })),

    /** Folds several bands into one row. Two that meet on the clock is what the edit surface passes. */
    mergeRows: (merging: readonly ReviewedRow[]) => apply(mergeRows({ edits: edits(), rows: merging })),

    labelRun: (id: string, label: { issueKey: string; note: string }) => timers.label(id, label),

    /**
     * Takes a path out of the working day for good. It is the answer for a side project the collectors
     * cannot tell from a client's checkout, and the day stops asking about it from here on.
     */
    markPathPrivate: (path: string) => settings.addProjectLink({ path, target: { kind: 'private' } }),

    /** Takes back the standing answer for a context, so the day asks about it again. */
    forgetRule: (id: string) => settings.removeAttributionRule(id),

    /**
     * Takes the offer a checkout's own record made: one rule for the whole checkout, written in the
     * same breath as the branch rule it replaces is taken back.
     */
    acceptNamingOffer: (offer: RepoNamingOffer) =>
      settings.replaceAttributionRule({
        rule: {
          id: `repo:${offer.repoPath}#${Date.now()}`,
          repoPath: offer.repoPath,
          target: { kind: 'issue', issueKey: offer.issueKey },
          author: 'user',
          createdAt: new Date(),
        },
        supersededIds: offer.supersedes.map((rule) => rule.id),
      }),

    /** Turns an offer down for this session. Nothing is written: the rules stay exactly as they were. */
    declineNamingOffer: (offer: RepoNamingOffer) => declinedOffers.update((declined) => [...declined, offer.repoPath]),

    /**
     * Writes the rule that names a context. It is a setting rather than an edit on this day: the same
     * branch comes back tomorrow, and answering for it once is the whole point.
     */
    nameContext: (context: UnnamedContext, target: AttributionTarget) => {
      settings.addAttributionRule({
        ...context.suggestion,
        id: `${context.id}#${Date.now()}`,
        target: target.kind === 'issue' ? { kind: 'issue', issueKey: target.issueKey.trim().toUpperCase() } : target,
        author: 'user',
        createdAt: new Date(),
      });

      if (target.kind === 'stand-in') settings.markStandInDay({ id: target.standInId, day: day() });
    },

    /**
     * Names a context with a stand-in the app opens for it, drafted from the branch subject.
     *
     * One press, because the answer it writes is a name and not a decision about Jira. The record and
     * the rule are one write: a rule stored without its record names nothing.
     */
    openStandInFor: (context: UnnamedContext) => {
      const current = settings.settings();
      const now = new Date();
      const standIn = openStandIn({
        name: standInNameFor({ context: context.context, config: gitFlowConfigFor(current) }),
        day: day(),
        now,
        projectKey: projectKeyFor({ context: context.context, links: projectLinks() }),
      });

      settings.nameWithStandIn({
        standIn,
        rule: {
          ...context.suggestion,
          id: `${context.id}#${now.getTime()}`,
          target: { kind: 'stand-in', standInId: standIn.id },
          author: 'user',
          createdAt: now,
        },
      });

      return standIn;
    },
  };
});

export const injectDayReview = /* @__PURE__ */ toInjectFn(DAY_REVIEW_DEF);
