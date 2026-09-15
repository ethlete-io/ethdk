import { DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AgentApiRowEdit,
  AttributionRule,
  AttributionTarget,
  ClosedTimerRun,
  CollectedEvent,
  DayReview,
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
  autoStandIns,
  classifyCalls,
  closeTimerRun,
  buildRows,
  breaksBetweenRows,
  coveredMsOf,
  dayBoundaryOf,
  fetchJiraIssueTouchedAt$,
  fetchTempoDayCoverage$,
  findStandIn,
  gitFlowConfigFor,
  hideRow,
  localDayKey,
  localDayRange,
  matchAttributionRule,
  callBehindRow,
  callLabel,
  meetingBehindRow,
  mergeRows,
  moveRowBoundary,
  namedIssueKeys,
  openStandIn,
  openStandIns,
  pauseWindows,
  pausedMs,
  projectKeyFor,
  readHeadBranches$,
  readJiraCredentials$,
  readTempoCredentials$,
  reasoningCandidates,
  RepoNamingDecisions,
  RepoNamingOffer,
  reasoningPlan,
  repoNamingDecisions,
  removeManualRow,
  resetRow,
  reviewDay,
  runReasoning$,
  setRowDescription,
  setRowDuration,
  setRowIssue,
  setRowRange,
  setRowStandIn,
  setRowState,
  shiftDayKey,
  showRow,
  splitRow,
  standInNameFor,
  streamDay,
  unnamedContexts,
} from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  concatMap,
  debounceTime,
  defer,
  filter,
  groupBy,
  map,
  mergeMap,
  of,
  startWith,
  switchMap,
  take,
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
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { dayRowsOptionsOf, streamDayOptionsOf } from '../stream-day-options';
import { injectTimer } from '../timer';
import { readViewState, rememberViewState } from '../view-state';

/** How long typing settles before a day's edits are written. */
const SAVE_DEBOUNCE_MS = 300;

/** A load tagged with the day it was asked for, so a stale answer is recognised rather than shown. */
type Loaded<T> = { key: string; value: T | null; failure: string | null };

/** One day's raw inputs, loaded together so a half-loaded day is never correlated. */
type DayEvidence = {
  events: CollectedEvent[];
  runs: ClosedTimerRun[];
  pauses: TimeWindow[];
  /** The instant the day is read through, for anything that has to cut off a stretch still open. */
  through: Date;
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
 * The engine's rows are never stored — only the edits are. So a day whose evidence grew since it was
 * reviewed shows the new evidence, and the reviewer's decisions still win over it.
 */
const DAY_REVIEW_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
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
  const timers = injectTimer();
  const settings = injectTimetrackSettings();
  const recurring = injectRecurringPatterns();

  const boundary = computed(() => dayBoundaryOf(settings.settings()));
  const day = signal(readViewState().day ?? localDayKey(new Date(), dayBoundaryOf(settings.settings())));
  const targetMs = computed(() => settings.settings().dayTargetMs);
  const local = signal<Record<string, DayReviewEdits>>({});
  const saves$ = new Subject<{ key: string; edits: DayReviewEdits }>();

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
          }).pipe(
            map((loaded) => ({
              ...loaded,
              through,
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
  const edits = computed(() => local()[day()] ?? editsLoad()?.value ?? EMPTY_DAY_REVIEW_EDITS);

  const rowOptions = computed(() => ({
    ...dayRowsOptionsOf({ settings: settings.settings(), patterns: recurring.patterns() }),
    timerRuns: evidence()?.runs ?? [],
    pauses: evidence()?.pauses ?? [],
  }));

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

    return collected
      ? streamDay({
          events: collected.events,
          options: streamDayOptionsOf({
            repoRoots: git.discovery()?.repos ?? [],
            settings: settings.settings(),
            patterns: recurring.patterns(),
            windowsSeenThroughMs: windows.lastRun()?.at.getTime(),
            rows: rowOptions(),
          }),
        })
      : null;
  });

  const deterministicRows = computed(() => streamed()?.rows ?? null);

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
      links: settings.settings().projectLinks,
      rules: settings.settings().attributionRules,
      worklogs: recurring.worklogs(),
      loggedIssues: recurring.loggedIssues(),
    }),
  );

  const namingOffers = computed(() =>
    namingDecisions().offers.filter((offer) => !declinedOffers().includes(offer.repoPath)),
  );

  /**
   * The same decision for a day that is not necessarily the one on screen — what the agent endpoint
   * calls. It moves the review to that day and waits for the Tempo history to settle, because a read
   * taken while the request is still out reports an empty history and every checkout would decline
   * with `no-history`.
   */
  const namingDecisionsOnDay$ = (target: string): Observable<RepoNamingDecisions> =>
    defer(() => {
      if (day() !== target) goToDay(target);

      return recurring.settled$.pipe(
        switchMap(() => evidenceState$),
        filter((state) => state.day === target && state.ready),
        take(1),
        map(() => namingDecisions()),
      );
    });

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
    if (!proposed.length) return current.rows;

    return buildRows({
      blocks: current.blocks,
      events: collected.events,
      links: settings.settings().projectLinks,
      calls: calls(),
      breaks: current.breaks,
      inferred: proposed,
      ...rowOptions(),
    });
  });

  /** The checkouts the day named no branch for: no commit, no branch switch and no agent session. */
  const unbranched = computed(() => {
    const current = streamed();

    if (!current) return null;

    return {
      at: localDayRange(day(), boundary()).to,
      repoPaths: current.streams
        .filter((stream) => !!stream.repoPath && !stream.branches.length)
        .map((stream) => stream.repoPath as string),
    };
  });

  /**
   * The branch each of those checkouts was on that day, from its reflog. It resolves after the day
   * does, so a slow repository delays the branch on one line and never the day's numbers.
   */
  const headBranches = toSignal(
    toObservable(unbranched).pipe(
      switchMap((ask) =>
        ask?.repoPaths.length
          ? readHeadBranches$({ processes: ports.processes, ...ask }).pipe(catchError(() => of({})))
          : of<Record<string, string>>({}),
      ),
    ),
    { initialValue: {} as Record<string, string> },
  );

  const isToday = computed(() => day() === localDayKey(new Date(), boundary()));

  const review = computed(() => {
    const rows = reasonedRows();

    return rows
      ? reviewDay({
          rows,
          edits: edits(),
          cut: rowOptions().cut,
          standIns: settings.settings().standIns,
          rules: settings.settings().attributionRules,
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
  const hiddenRows = computed(() => review()?.hidden ?? []);
  const breaks = computed(() => breaksBetweenRows({ breaks: streamed()?.breaks ?? [], rows: rows() }));

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
   */
  effect(() => {
    const load = evidenceLoad();
    const deterministic = deterministicRows();

    if (!load || load.failure || !deterministic || recurring.state().state === 'loading') return;

    const current = settings.settings();
    const key = day();

    for (const opened of autoStandIns({
      contexts: unnamed(),
      unattributed: deterministic.unattributed,
      links: current.projectLinks,
      rules: current.attributionRules,
      config: gitFlowConfigFor(current),
      repoRoots: git.discovery()?.repos,
      offeredCheckouts: namingOffers().map((offer) => offer.repoPath),
      standIns: current.standIns,
      refusedCheckouts: current.noStandInCheckouts,
      day: key,
      now: new Date(),
    })) {
      settings.nameWithStandIn({ standIn: opened.standIn, rule: opened.rule });
    }

    for (const id of new Set(rows().flatMap((row) => (row.standInId ? [row.standInId] : [])))) {
      const standIn = findStandIn({ id, standIns: settings.settings().standIns });

      if (standIn && !standIn.days.includes(key)) settings.markStandInDay({ id, day: key });
    }
  });

  // The whole day's ledger, not the rows': an entry no row claims is a worklog the sync has to delete,
  // and a read by row id can never return it. The failure stays inside the switch, or one failed read
  // would end the subscription and no later day would be read at all.
  const ledger = toSignal(
    toObservable(day).pipe(
      switchMap((key) => ports.ledger.entriesForDay$(key).pipe(catchError(() => of<SyncedWorklog[]>([])))),
    ),
    { initialValue: [] as SyncedWorklog[] },
  );

  const syncedIds = computed(() => new Set(ledger().map((entry) => entry.proposalId)));

  saves$
    .pipe(
      groupBy((entry) => entry.key),
      mergeMap((perDay) =>
        perDay.pipe(
          debounceTime(SAVE_DEBOUNCE_MS),
          concatMap(({ key, edits: next }) => ports.review.save$(key, next).pipe(catchError(() => of(undefined)))),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const apply = (next: DayReviewEdits) => {
    const key = day();

    local.update((all) => ({ ...all, [key]: next }));
    saves$.next({ key, edits: next });
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
      options: { command: settings.settings().reasoning.command, model: settings.settings().reasoning.model },
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

  /** Whether the day on screen holds its own evidence yet, which is what its streams are built from. */
  const evidenceState$ = toObservable(
    computed(() => {
      const load = evidenceLoad();

      return { day: day(), ready: !!load, failure: load?.failure ?? null };
    }),
  );

  /** Whether the day on screen holds its own edits yet, and why it never will when a read failed. */
  const editsState$ = toObservable(
    computed(() => {
      const load = editsLoad();

      return { day: day(), ready: !!local()[day()] || (!!load && !load.failure), failure: load?.failure ?? null };
    }),
  );

  /** The drawn day, once it is drawn at all, with the read that stopped it being drawn named instead. */
  const reviewState$ = toObservable(
    computed(() => ({
      day: day(),
      review: review(),
      failure: evidenceLoad()?.failure ?? editsLoad()?.failure ?? null,
    })),
  );

  /**
   * Writes a row onto a day that is not necessarily the one on screen — what the agent endpoint calls.
   *
   * It moves the review to that day and waits for that day's stored edits to arrive. Applying before
   * they do would write the row onto an empty document, and the save behind it would take every earlier
   * edit of the day with it.
   */
  /**
   * Runs a write against a day that is not necessarily the one on screen.
   *
   * It moves the review to that day and waits for that day's stored edits to arrive. Writing before
   * they do would apply against an empty document, and the save behind it would take every earlier
   * edit of the day with it.
   */
  const onDay$ = <T>(key: string, write: () => T): Observable<T> =>
    defer(() => {
      if (day() !== key) goToDay(key);

      return editsState$.pipe(
        filter((state) => state.day === key && (state.ready || !!state.failure)),
        take(1),
        map((state) => {
          if (state.failure) throw new Error(`Timetrack cannot read the edits of ${key}: ${state.failure}`);

          return write();
        }),
      );
    });

  const addRowOnDay$ = (options: { day: string; row: ManualRow }): Observable<void> =>
    onDay$(options.day, () => {
      apply(addManualRow({ edits: edits(), row: options.row }));
    });

  /**
   * The day as its own review draws it, for a day that is not necessarily the one on screen.
   *
   * It moves the review there and waits for the day to be drawn, because a row's id only exists once
   * it is. A read that failed is reported rather than answered as an empty day.
   */
  const reviewOfDay$ = (key: string): Observable<DayReview> =>
    defer(() => {
      if (day() !== key) goToDay(key);

      return reviewState$.pipe(
        filter((state) => state.day === key && (!!state.review || !!state.failure)),
        take(1),
        map((state) => {
          if (!state.review) throw new Error(`Timetrack cannot read the day ${key}: ${state.failure}`);

          return state.review;
        }),
      );
    });

  /** One stated change, against the row of the day it names. Nothing happens where no row holds it. */
  const applyRowEdit = (edit: AgentApiRowEdit) => {
    const row = [...rows(), ...hiddenRows()].find((candidate) => candidate.id === edit.rowId);

    if (!row) return false;

    switch (edit.kind) {
      case 'range':
        apply(setRowRange({ edits: edits(), row, from: new Date(edit.fromMs), to: new Date(edit.toMs) }));
        break;
      case 'issue':
        apply(setRowIssue({ edits: edits(), row, issueKey: edit.issueKey }));
        break;
      case 'description':
        apply(setRowDescription({ edits: edits(), row, description: edit.description }));
        break;
      case 'state':
        apply(setRowState({ edits: edits(), row, state: edit.state }));
        break;
      case 'hidden':
        apply(edit.hidden ? hideRow({ edits: edits(), row }) : showRow({ edits: edits(), row }));
        break;
      case 'reset':
        apply(resetRow({ edits: edits(), row }));
        break;
    }

    return true;
  };

  /**
   * Makes the edits an agent's CLI stated against a day, and answers how many of them landed.
   *
   * Each is resolved against the day as the ones before it left it, so a caller may name a row and
   * then move it in one call. An edit naming a row the day no longer holds is counted out rather than
   * failing the write, because the day it was read from is a day the collectors keep changing.
   */
  const editRowsOnDay$ = (options: { day: string; edits: readonly AgentApiRowEdit[] }): Observable<number> =>
    onDay$(options.day, () => options.edits.filter(applyRowEdit).length);

  return {
    dayKey: day.asReadonly(),
    targetMs,
    rows,
    /** The rows taken off the timeline. Neither written nor unattributed — this is where their time went. */
    hiddenRows,
    /** The day's breaks as the rows leave them, which is the only place a break is drawn. */
    breaks,
    review,
    /** The day as its streams: presence, concurrency, the agents' spend and the blocks behind the rows. */
    day: streamed,
    /** The branch a checkout the day named none for was on, by checkout path, from its reflog. */
    headBranches,
    isToday,
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
    namingDecisionsOnDay$,
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
      apply(setRowIssue({ edits: edits(), row, issueKey }));

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
    /** The names the user gave work Jira does not hold yet and has not answered, newest first. */
    openStandIns: computed(() => openStandIns(settings.settings().standIns)),

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
     */
    addRow: (row: ManualRow) => apply(addManualRow({ edits: edits(), row })),

    /**
     * The same, for a row an agent's CLI wrote from another repository. It moves the review to the day
     * the row belongs to, which is also how the reviewer finds out that something was added at all.
     */
    addRowOnDay$,

    /**
     * The edits an agent's CLI stated against a day. It moves the review to that day for the same
     * reason `addRowOnDay$` does: the reviewer finds out a row changed by looking at it.
     */
    editRowsOnDay$,

    /** The day as the screen draws it, for any day. It is where a row's id comes from. */
    reviewOfDay$,

    /** Where a dragged row now sits. A move keeps its duration; dragging one end re-reads it. */
    rescheduleRow: (move: { row: ReviewedRow; from: Date; to: Date }) =>
      apply(setRowRange({ edits: edits(), ...move })),

    /** Takes a hand-written row off the day. An engine proposal is rejected rather than removed. */
    removeRow: (row: ReviewedRow) => apply(removeManualRow({ edits: edits(), row })),

    /** Takes a row off the timeline without throwing it away. `show` is the only way back. */
    hide: (row: ReviewedRow) => apply(hideRow({ edits: edits(), row })),

    /** Puts a hidden row back on the timeline with every other edit it carries intact. */
    show: (row: ReviewedRow) => apply(showRow({ edits: edits(), row })),

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
        projectKey: projectKeyFor({ context: context.context, links: current.projectLinks }),
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
