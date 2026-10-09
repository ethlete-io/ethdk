import { computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AUTO_MODE_CLIENT,
  AgentApproval,
  AutoModeAnswer,
  AutoModeDispute,
  AutoModeHideRequest,
  AutoModeOutcome,
  CollectedEvent,
  AutoModeSubject,
  AgentApiAutoModeAsk,
  DayRows,
  JiraCredentials,
  JiraIssue,
  JiraIssueState,
  JiraMirror,
  TicketCandidate,
  TicketWording,
  UnnamedContext,
  ReviewedRow,
  TicketWritingRequest,
  actionClassOf,
  anonymousDayReport,
  autoModeActs,
  autoModeApplies,
  autoModeApplyRequest,
  autoModeApplyTarget,
  autoModeApprovalTarget,
  autoModeAskRefusal,
  autoModeAsks,
  autoModeCreateRequest,
  autoModeContextLabel,
  autoModeCreatedKeys,
  autoModeHideAsks,
  autoModeHideRequest,
  autoModeHideTarget,
  autoModeKeyInEvidence,
  autoModeQueuedAnswer,
  autoModeSentTranscript,
  autoModeReadout,
  autoModeReaskSubjectOf,
  autoModeSubjectKey,
  autoModeSubjectRequest,
  autoDescriptionAsks,
  isAutoModeCallRow,
  autoDisputeApplies,
  autoDisputeAsks,
  autoDisputeDoneChoice,
  autoDisputeRequest,
  autoDisputeResolveRequest,
  autoModeResolveTarget,
  disputedTargetLabel,
  disputedTargetOf,
  resolveDisputeWithAgent$,
  streamKeyLabel,
  withAutoModeDispute,
  autoDescriptionRequest,
  autoDescriptionRowId,
  autoDescriptionTicketId,
  AutoDescriptionAsk,
  isDayHeldByTempo,
  ledgerEntriesForRange$,
  dayBoundaryOf,
  epicKeysFor,
  epicKeysOfIssues,
  favoriteProjectKeys,
  fetchJiraDoneIssueKeys$,
  fetchJiraIssueState$,
  fetchJiraOpenIssues$,
  fetchJiraIssues$,
  gitFlowConfigFor,
  isAgentApiRequest,
  inferTicketProjectKey,
  localDayKey,
  ModelCall,
  matchAttributionRule,
  reasoningOptionsOf,
  recordingRunner,
  rankMirrorCandidates,
  readJiraCredentials$,
  shiftDayKey,
  ticketRequestText,
  userNamedIssueKeysIn,
  withAutoModeAnswer,
  withAutoModeSubjectItemsExpired,
  withNamedContextItemsExpired,
  withTextlessSubjectItemsExpired,
  withUnnamedSubjectItemsExpired,
  autoModeMergeRequestOutcome,
  autoModeWorkFacts,
  WorkFacts,
  withAutoModeCreated,
  withAutoModeDescription,
  writeTicketWithAgent$,
  writeWorklogWithAgent$,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  Subject,
  asyncScheduler,
  observeOn,
  catchError,
  concatMap,
  defer,
  exhaustMap,
  finalize,
  forkJoin,
  from,
  interval,
  map,
  of,
  switchMap,
  take,
  takeWhile,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { injectGitCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectAgentDay } from '../agent/agent-day';
import { injectApprovalQueue } from '../agent/approval-queue';
import { injectJiraMirror } from '../jira/jira-mirror';
import { injectEpicSiblings } from '../naming/epic-siblings';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectProjectLinks } from '../project-links';
import { injectTimetrackSettings } from '../settings/settings';
import { injectWindowLock } from '../window-lock';
import { runStandInPass } from '../stand-ins/stand-in-pass';
import { injectStandIns } from '../stand-ins/stand-ins';
import { callTranscriptOf$ } from './call-transcript';
import { injectDayReview } from './day-review';
import { createDayReadCache } from './day-read-cache';
import { ProjectIssues, matchCandidatesOf, readLoggedKeys$, readProjectIssues$ } from './project-issues';

/** How often settle times are checked again: a row or a context settles by the clock, not by a change. */
const SETTLE_TICK_MS = 60_000;

/** How often today is read while the screen shows another day. Each pass is a whole day read. */
const OFF_SCREEN_TICK_MS = 5 * 60_000;

type AskEvidence = {
  contexts: readonly UnnamedContext[];
  rows: DayRows;
  reviewed: readonly ReviewedRow[];
  workFacts?: ReadonlyMap<string, WorkFacts>;
} | null;

type Ask = { day: string; subject: AutoModeSubject; evidence$: Observable<AskEvidence> };

type Job = {
  key: string;
  day: string;
  label: string;
  stillNeeded: () => boolean;
  work: () => Observable<string | void>;
};

/** One job auto mode ran in this app session. Nothing stores it: the per-day readout is the record. */
export type AutoModeActivity = {
  id: number;
  day: string;
  label: string;
  startedAtMs: number;
  endedAtMs?: number;
  state: 'running' | 'done' | 'failed';
  detail?: string;
  error?: string;
};

const ACTIVITY_LIMIT = 50;

const MODEL_CALL_LIMIT = 30;

const CHECKOUT_EPIC_WEEKS = 4;

const CHECKOUT_EPIC_ISSUE_LIMIT = 50;

/** What one ask sends: the payload, the issues it offered, and the project a new ticket would be filed in. */
type Prepared = {
  request: TicketWritingRequest;
  facts?: WorkFacts;
  candidates: readonly TicketCandidate[];
  projectKey?: string;
  parentKeys: ReadonlySet<string>;
};

const parentKeysOf = (issues: ProjectIssues | null): ReadonlySet<string> => {
  if (!issues) return new Set();

  const keys = new Set(issues.parents.map((issue) => issue.key));

  for (const issue of matchCandidatesOf(issues)) {
    if (issue.parentKey) keys.add(issue.parentKey);
  }

  return keys;
};

const outcomeOf = (options: {
  wording: TicketWording | null;
  prepared: Prepared;
  maskedNames: readonly string[];
}): AutoModeOutcome => {
  const { wording, prepared } = options;
  const { projectKey, parentKeys } = prepared;

  if (!wording) return { kind: 'failed' };
  if (wording.existingKey) {
    const issueKey = wording.existingKey;
    const summary = prepared.candidates.find((issue) => issue.key.toUpperCase() === issueKey.toUpperCase())?.summary;
    const evidenced = autoModeKeyInEvidence({ request: prepared.request, issueKey, maskedNames: options.maskedNames });

    return {
      kind: 'match',
      issueKey,
      ...(parentKeys.has(issueKey) ? { parent: true } : {}),
      ...(wording.existingReason ? { reason: wording.existingReason } : {}),
      ...(summary ? { summary } : {}),
      ...(evidenced ? {} : { listOnly: true }),
    };
  }

  return {
    kind: 'draft',
    summary: wording.summary,
    description: wording.description,
    ...(projectKey ? { projectKey } : {}),
    ...(wording.parentKey ? { parentKey: wording.parentKey } : {}),
  };
};

/**
 * Runs the "Ask AI" ticket call without a press on each new unnamed band and open stand-in of today,
 * while auto mode is on. See ADR 0035.
 *
 * A match is applied as `auto`, or waits in the approval queue as an `autoMode.apply` where the user
 * made applying stricter; a draft waits as a `jira.create`, and the key its approval files is applied
 * the same way. Every answer is stored against the day with the payload it sent, so a band is asked
 * again only when the evidence that payload was built from changes while the answer is still auto's,
 * or on a press of "Ask auto mode again", and the new answer expires what the old one left waiting.
 * A settled code row with a ticket gets a one-line worklog description written as `auto`, once per
 * row, where applying is `local`. The rest band of a call gone off topic waits as an `autoMode.hide`
 * suggestion, once per band. A band two rungs disagree about is settled with a keep or use answer the
 * same way a match is applied, once per pair of answers; an unsure answer leaves it.
 */
const AUTO_MODE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const dayReview = injectDayReview();
  const agentDay = injectAgentDay();
  const approvals = injectApprovalQueue();
  const projectLinks = injectProjectLinks();
  const windowLock = injectWindowLock();
  const recurring = injectRecurringPatterns();
  const standInStore = injectStandIns();
  const git = injectGitCollector();
  const epics = injectEpicSiblings();
  const jiraMirror = injectJiraMirror();
  const reportCopy = signal<{ ok: boolean; atMs: number } | null>(null);
  const modelCalls = signal<readonly ModelCall[]>([]);
  const runner = recordingRunner({
    runner: ports.processes,
    record: (call) =>
      modelCalls.update((calls) =>
        calls.some((entry) => entry.id === call.id)
          ? calls.map((entry) => (entry.id === call.id ? call : entry))
          : [call, ...calls].slice(0, MODEL_CALL_LIMIT),
      ),
  });
  const jobs$ = new Subject<Job>();
  const pending = signal<ReadonlySet<string>>(new Set());
  const activity = signal<readonly AutoModeActivity[]>([]);
  let nextActivityId = 0;

  const began = (job: Job) => {
    const id = nextActivityId++;

    activity.update((entries) =>
      [{ id, day: job.day, label: job.label, startedAtMs: Date.now(), state: 'running' as const }, ...entries].slice(
        0,
        ACTIVITY_LIMIT,
      ),
    );

    return id;
  };

  const ended = (id: number, end: Pick<AutoModeActivity, 'state' | 'error' | 'detail'>) =>
    activity.update((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, ...end, endedAtMs: Date.now() } : entry)),
    );
  const minuteTick = toSignal(interval(SETTLE_TICK_MS), { initialValue: -1 });

  const enabled = computed(() => {
    const { reasoning } = settings.settings();

    return (
      reasoning.enabled &&
      reasoning.autoMode &&
      autoModeActs(settings.settings().actionClasses) &&
      !windowLock.isLocked()
    );
  });

  const appliesOn = (day: string) => (answer: AutoModeAnswer) =>
    autoModeApplies({ day, answer, classes: settings.settings().actionClasses, approvals: approvals.items() });

  const disputeAppliesOn = (day: string) => (dispute: AutoModeDispute) =>
    autoDisputeApplies({ day, dispute, classes: settings.settings().actionClasses, approvals: approvals.items() });

  const callRowOf = (rowId: string, rows: readonly ReviewedRow[]) =>
    rows.find((row) => autoDescriptionRowId(row) === rowId);

  const callLabelOf = (row: ReviewedRow | undefined) =>
    row?.evidence.find((entry) => entry.kind === 'call')?.summary ?? 'call';

  const labelOf = (subject: AutoModeSubject) => {
    switch (subject.kind) {
      case 'context':
        return autoModeContextLabel(subject.contextId);
      case 'stand-in':
        return settings.settings().standIns.find((entry) => entry.id === subject.standInId)?.name ?? '';
      case 'call':
        return callLabelOf(callRowOf(subject.rowId, dayReview.rows()));
    }
  };

  const today = () => localDayKey(new Date(), dayBoundaryOf(settings.settings()));

  const workFactsOf = (options: {
    day: string;
    contexts: readonly UnnamedContext[];
    reviewed: readonly ReviewedRow[];
    events: readonly CollectedEvent[];
  }) => {
    const current = settings.settings();

    return autoModeWorkFacts({
      contexts: options.contexts,
      standIns: current.standIns.filter((standIn) => standIn.days.includes(options.day)),
      bands: options.reviewed,
      events: options.events,
      config: gitFlowConfigFor(current),
      repoKeys: git.remoteKeys(),
    });
  };

  const screenWorkFacts = computed(() => {
    const events = dayReview.events();

    return events
      ? workFactsOf({ day: dayReview.dayKey(), contexts: dayReview.unnamed(), reviewed: dayReview.rows(), events })
      : undefined;
  });

  const askedNow = (day: string) => {
    const answers = dayReview.autoAnswers();

    minuteTick();

    if (!answers || dayReview.isLoading() || !dayReview.deterministic() || !dayReview.namingSettled()) return [];
    if (dayReview.dayKey() !== day) return [];

    const current = settings.settings();

    return autoModeAsks({
      enabled: enabled(),
      day,
      today: today(),
      nowMs: Date.now(),
      contexts: dayReview.unnamed(),
      ruledContextIds: new Set(dayReview.rulesByContext().keys()),
      standIns: current.standIns,
      rows: dayReview.rows(),
      answers,
      evidence: {
        unattributed: dayReview.deterministic()?.unattributed ?? [],
        config: gitFlowConfigFor(current),
        maskedNames: current.reasoning.maskedNames,
        workFacts: screenWorkFacts(),
      },
      transcribedCalls: transcribedCalls(),
      ...(approvals.isLoaded() ? { approvals: approvals.items() } : {}),
    });
  };

  const describedNow = (day: string) => {
    const edits = dayReview.storedEdits();

    minuteTick();

    if (!edits || dayReview.isLoading() || dayReview.dayKey() !== day) return [];

    return autoDescriptionAsks({
      enabled: enabled(),
      day,
      today: today(),
      nowMs: Date.now(),
      classes: settings.settings().actionClasses,
      rows: dayReview.rows(),
      answers: edits.autoDescriptions ?? [],
      maskedNames: settings.settings().reasoning.maskedNames,
      backgroundProjects: settings.settings().backgroundProjects,
      heldByTempo: dayReview.heldByTempo(),
    });
  };

  const disputesNow = (day: string) => {
    const edits = dayReview.storedEdits();

    if (!edits || !approvals.isLoaded() || dayReview.isLoading() || !dayReview.namingSettled()) return [];
    if (dayReview.dayKey() !== day) return [];

    return autoDisputeAsks({
      enabled: enabled(),
      day,
      today: today(),
      classes: settings.settings().actionClasses,
      rows: dayReview.rows(),
      edits,
    });
  };

  const otherLabelOf = (row: ReviewedRow) => {
    const other = disputedTargetOf(row);

    if (other?.kind !== 'stand-in') return other ? disputedTargetLabel(other) : '';

    return (
      settings.settings().standIns.find((entry) => entry.id === other.standInId)?.name ?? disputedTargetLabel(other)
    );
  };

  const hidesNow = (day: string) => {
    if (!approvals.isLoaded() || dayReview.dayKey() !== day) return [];

    return autoModeHideAsks({
      enabled: enabled(),
      day,
      today: today(),
      classes: settings.settings().actionClasses,
      rests: dayReview.offTopicRests(),
      approvals: approvals.items(),
    });
  };

  const suggestHide$ = (day: string, row: ReviewedRow): Observable<void> =>
    approvals
      .enqueue$({
        request: autoModeHideRequest({ day, row }),
        client: AUTO_MODE_CLIENT,
        target: autoModeHideTarget(day, row.id),
      })
      .pipe(map(() => undefined));

  const hideApproved$ = (item: Pick<AgentApproval, 'id'> & { request: AutoModeHideRequest }): Observable<void> =>
    agentDay
      .editRows$({ day: item.request.day, edits: [{ kind: 'hidden', rowId: item.request.rowId, hidden: true }] })
      .pipe(
        map(({ applied }) =>
          approvals.finish(
            item.id,
            applied
              ? { ok: true, value: { hidden: item.request.rowId } }
              : { ok: false, message: 'The day no longer holds that rest band.' },
          ),
        ),
        catchError((error: unknown) => {
          approvals.finish(item.id, { ok: false, message: error instanceof Error ? error.message : String(error) });

          return EMPTY;
        }),
      );

  const checkoutEpicReads = createDayReadCache<string[]>();

  const readMoment = () => ({
    day: today(),
    nowMs: Date.now(),
    standInIds: settings.settings().standIns.map((entry) => entry.id),
  });

  const checkoutEpicKeys$ = (options: {
    credentials: JiraCredentials;
    repoPath: string;
    mirror: JiraMirror;
  }): Observable<string[]> =>
    checkoutEpicReads({
      key: options.repoPath,
      now: readMoment(),
      read$: () => {
        const day = today();
        const held = new Map(options.mirror.issues.map((issue) => [issue.key.toUpperCase(), issue]));

        return ports.review.editsBetween$(shiftDayKey(day, -CHECKOUT_EPIC_WEEKS * 7), day).pipe(
          take(1),
          map((days) => userNamedIssueKeysIn(days, `repo:${options.repoPath}`).slice(0, CHECKOUT_EPIC_ISSUE_LIMIT)),
          switchMap((keys) => {
            const known = keys.flatMap((key) => held.get(key.toUpperCase()) ?? []);
            const missing = keys.filter((key) => !held.has(key.toUpperCase()));

            return (
              missing.length
                ? fetchJiraIssues$({ transport: ports.transport, credentials: options.credentials, keys: missing })
                : of<JiraIssue[]>([])
            ).pipe(map((read) => [...known, ...read]));
          }),
          map(epicKeysOfIssues),
        );
      },
    });

  const epicKeys$ = (options: {
    credentials: JiraCredentials;
    repoPath: string | undefined;
    mirror: JiraMirror;
  }): Observable<string[]> => {
    const { repoPath } = options;

    if (!repoPath) return of([]);

    const linked = epicKeysFor({ context: { repoPath }, links: projectLinks() });

    return linked.length ? of(linked) : checkoutEpicKeys$({ ...options, repoPath });
  };

  const rankedOpen$ = (options: {
    credentials: JiraCredentials;
    projectKey: string;
    repoPath: string | undefined;
    text: string;
  }): Observable<TicketCandidate[]> => {
    const { credentials, projectKey, repoPath, text } = options;

    return jiraMirror.mirror$(projectKey).pipe(
      switchMap((mirror) =>
        mirror
          ? epicKeys$({ credentials, repoPath, mirror }).pipe(
              catchError(() => of<string[]>([])),
              map((epicKeys) => rankMirrorCandidates({ issues: mirror.issues, projectKey, text, epicKeys })),
            )
          : fetchJiraOpenIssues$({
              transport: ports.transport,
              credentials,
              projectKey,
              subjectField: settings.settings().ticket.subjectField || undefined,
            }),
      ),
    );
  };

  const repoPathOf = (subject: AutoModeSubject, evidence: AskEvidence) => {
    if (subject.kind === 'call') return undefined;

    return subject.kind === 'stand-in'
      ? settings.settings().standIns.find((entry) => entry.id === subject.standInId)?.openedFor
      : evidence?.contexts.find((entry) => entry.id === subject.contextId)?.context.repoPath;
  };

  const issues$ = (options: {
    subject: AutoModeSubject;
    projectKey: string | undefined;
    repoPath: string | undefined;
    text: string;
  }): Observable<ProjectIssues | null> => {
    const { subject, projectKey, repoPath, text } = options;

    if (!projectKey) return of(null);

    const standInDays =
      subject.kind === 'stand-in'
        ? settings.settings().standIns.find((entry) => entry.id === subject.standInId)?.days
        : undefined;

    return recurring.settled$.pipe(
      switchMap(() =>
        readLoggedKeys$({
          ports,
          settings: settings.settings(),
          tempoKeys: recurring.loggedIssues().map((issue) => issue.issueKey),
          standInDays,
        }),
      ),
      switchMap((loggedKeys) =>
        readProjectIssues$({
          ports,
          settings: settings.settings(),
          projectKey,
          loggedKeys,
          open$: (credentials) => rankedOpen$({ credentials, projectKey, repoPath, text }),
        }),
      ),
      catchError(() => of(null)),
    );
  };

  const projectKeyOf = (subject: AutoModeSubject, evidence: AskEvidence) => {
    const current = settings.settings();

    if (subject.kind === 'call') return undefined;

    if (subject.kind === 'stand-in') {
      return current.standIns.find((entry) => entry.id === subject.standInId)?.projectKey;
    }

    const context = evidence?.contexts.find((entry) => entry.id === subject.contextId);

    if (!context) return undefined;

    return (
      inferTicketProjectKey({
        context: context.context,
        rules: current.attributionRules,
        proposals: evidence?.rows.proposals ?? [],
        projectKeys: favoriteProjectKeys(current),
        links: projectLinks(),
      }) ?? undefined
    );
  };

  const requestOf = (options: {
    subject: AutoModeSubject;
    evidence: AskEvidence;
    issues: ProjectIssues | null;
    candidates: readonly TicketCandidate[];
    call?: { label: string; observedMs: number; transcript?: string };
  }) => {
    const { subject, evidence, issues, candidates } = options;
    const current = settings.settings();

    if (subject.kind === 'context' && !evidence) return null;

    return autoModeSubjectRequest({
      subject,
      contexts: evidence?.contexts ?? [],
      unattributed: evidence?.rows.unattributed ?? [],
      standIns: current.standIns,
      bands: evidence?.reviewed ?? [],
      config: gitFlowConfigFor(current),
      maskedNames: current.reasoning.maskedNames,
      parents: issues?.parents ?? [],
      issues: candidates,
      bookedDays: standInStore.bookedDays(),
      workFacts: evidence?.workFacts,
      ...(options.call ? { call: options.call } : {}),
    });
  };

  const callTranscript$ = (row: ReviewedRow, evidence: AskEvidence): Observable<string | undefined> => {
    const current = settings.settings();

    if (!current.transcribeCalls || !current.reasoning.autoModeTranscripts) return of(undefined);

    return callTranscriptOf$({ ports, row, calls: evidence?.rows.calls ?? [] }).pipe(catchError(() => of(undefined)));
  };

  const askedCallRowIds = (answers: readonly AutoModeAnswer[], rows: readonly ReviewedRow[]) => {
    const held = new Set(
      answers.flatMap((answer) =>
        answer.subject.kind === 'call' && !autoModeSentTranscript(answer) ? [answer.subject.rowId] : [],
      ),
    );

    return rows
      .filter((row) => isAutoModeCallRow(row) && held.has(autoDescriptionRowId(row)))
      .map((row) => autoDescriptionRowId(row));
  };

  const transcribedCallsOf$ = (options: { rowIds: readonly string[]; evidence: AskEvidence }) => {
    const { evidence } = options;

    if (!evidence || !options.rowIds.length) return of(new Set<string>());

    return forkJoin(
      options.rowIds.map((rowId) => {
        const row = callRowOf(rowId, evidence.reviewed);

        return row ? callTranscript$(row, evidence).pipe(map((transcript) => (transcript ? rowId : null))) : of(null);
      }),
    ).pipe(map((ids) => new Set(ids.flatMap((id) => (id ? [id] : [])))));
  };

  const callsToTranscribe = computed(
    () => {
      const answers = dayReview.autoAnswers();
      const current = settings.settings();

      if (!enabled() || !answers || !current.transcribeCalls || !current.reasoning.autoModeTranscripts) return [];
      if (dayReview.dayKey() !== today()) return [];

      return askedCallRowIds(answers, dayReview.rows());
    },
    { equal: (left, right) => left.join() === right.join() },
  );

  const transcribedCalls = toSignal(
    toObservable(callsToTranscribe).pipe(
      switchMap((rowIds) =>
        rowIds.length
          ? timer(0, SETTLE_TICK_MS).pipe(
              switchMap(() => screenEvidence$),
              switchMap((evidence) => transcribedCallsOf$({ rowIds, evidence })),
            )
          : of(new Set<string>()),
      ),
    ),
    { initialValue: new Set<string>() },
  );

  const prepareCall$ = (rowId: string, evidence: AskEvidence): Observable<Prepared | null> => {
    const row = evidence && callRowOf(rowId, evidence.reviewed);

    if (!row) return of(null);

    const candidates: TicketCandidate[] = recurring
      .loggedIssues()
      .map((issue) => ({ key: issue.issueKey, id: '', summary: issue.summary, issueType: '' }));

    return callTranscript$(row, evidence).pipe(
      map((transcript) => {
        const call = { label: callLabelOf(row), observedMs: row.observedMs, ...(transcript ? { transcript } : {}) };
        const request = requestOf({ subject: { kind: 'call', rowId }, evidence, issues: null, candidates, call });

        return request ? { request, candidates, parentKeys: new Set<string>() } : null;
      }),
    );
  };

  const prepare$ = (subject: AutoModeSubject, evidence: AskEvidence): Observable<Prepared | null> => {
    if (subject.kind === 'call') return prepareCall$(subject.rowId, evidence);

    const bare = requestOf({ subject, evidence, issues: null, candidates: [] });

    if (!bare) return of(null);

    const projectKey = projectKeyOf(subject, evidence);

    return issues$({
      subject,
      projectKey,
      repoPath: repoPathOf(subject, evidence),
      text: ticketRequestText(bare),
    }).pipe(
      map((issues) => {
        const candidates = issues ? matchCandidatesOf(issues) : [];
        const request = requestOf({ subject, evidence, issues, candidates });

        const facts = evidence?.workFacts?.get(autoModeSubjectKey(subject));

        return request
          ? {
              request,
              candidates,
              parentKeys: parentKeysOf(issues),
              ...(projectKey ? { projectKey } : {}),
              ...(facts ? { facts } : {}),
            }
          : null;
      }),
    );
  };

  /**
   * Queues the create before the answer is stored, so a restart between the two writes asks again
   * rather than losing it. The target makes that second ask take over the create the first one queued.
   */
  const queued$ = (day: string, answer: AutoModeAnswer): Observable<AutoModeAnswer> => {
    const create = autoModeCreateRequest(answer);

    if (!create?.projectKey) return of(answer);

    return approvals
      .enqueue$({ request: create, client: AUTO_MODE_CLIENT, target: autoModeApprovalTarget(day, answer.subject) })
      .pipe(
        map(({ approvalId }) => {
          const item = approvals.items().find((entry) => entry.id === approvalId);

          return autoModeQueuedAnswer(answer, item ?? { id: approvalId, request: create });
        }),
        catchError(() => of(answer)),
      );
  };

  const queuedApply$ = (day: string, answer: AutoModeAnswer): Observable<boolean> => {
    const request = autoModeApplyRequest({
      day,
      answer,
      label: labelOf(answer.subject),
      classes: settings.settings().actionClasses,
    });

    if (!request) return of(false);

    return approvals
      .enqueue$({ request, client: AUTO_MODE_CLIENT, target: autoModeApplyTarget(day, answer.subject) })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  };

  const applyAnswer$ = (day: string, answer: AutoModeAnswer): Observable<void> => {
    const { subject, outcome } = answer;

    if (subject.kind === 'context' || subject.kind === 'call') {
      if (dayReview.dayKey() !== day) return agentDay.applyAutoModeNames$({ day, applies: appliesOn(day) });

      dayReview.applyAutoModeNames(appliesOn(day));

      return of(undefined);
    }

    if (outcome.kind === 'match') {
      if (appliesOn(day)(answer)) {
        standInStore.resolve({ id: subject.standInId, issueKey: outcome.issueKey, source: 'auto' });
      }
    } else if (
      outcome.kind === 'draft' &&
      outcome.parentKey &&
      actionClassOf('autoMode.apply', settings.settings().actionClasses) === 'local'
    ) {
      settings.setStandInParent({ id: subject.standInId, parentKey: outcome.parentKey, source: 'auto' });
    }

    return of(undefined);
  };

  const issueState$ = (issueKey: string): Observable<JiraIssueState | null> =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials ? fetchJiraIssueState$({ transport: ports.transport, credentials, issueKey }) : of(null),
      ),
      catchError(() => of(null)),
    );

  const withIssueState$ = (answer: AutoModeAnswer): Observable<AutoModeAnswer> => {
    const { outcome } = answer;

    if (outcome.kind !== 'match') return of(answer);

    return issueState$(outcome.issueKey).pipe(
      map((state) => {
        if (state === 'done') return { ...answer, outcome: { ...outcome, done: true } };
        if (state === 'gone') return { ...answer, outcome: { ...outcome, gone: true } };

        return answer;
      }),
    );
  };

  const screenEvidence$ = defer(() => {
    const rows = dayReview.deterministic();

    return of<AskEvidence>(
      rows ? { contexts: dayReview.unnamed(), rows, reviewed: dayReview.rows(), workFacts: screenWorkFacts() } : null,
    );
  });

  const heldAnswers$ = (day: string): Observable<readonly AutoModeAnswer[]> =>
    defer(() => {
      const held = dayReview.heldEditsOf(day);

      return held
        ? of(held.auto ?? [])
        : ports.review.editsFor$(day).pipe(
            take(1),
            map((stored) => stored?.auto ?? []),
          );
    });

  const answer$ = (ask: Ask): Observable<string | void> =>
    ask.evidence$.pipe(
      take(1),
      switchMap((evidence) => prepare$(ask.subject, evidence)),
      switchMap((prepared) => {
        if (!prepared) return EMPTY;

        const current = settings.settings();
        const own = autoModeMergeRequestOutcome(prepared.facts);

        if (own?.kind === 'match') {
          return of<AutoModeAnswer>({
            subject: ask.subject,
            askedAtMs: Date.now(),
            request: prepared.request,
            outcome: prepared.parentKeys.has(own.issueKey) ? { ...own, parent: true } : own,
          });
        }

        return writeTicketWithAgent$({
          runner,
          request: prepared.request,
          options: reasoningOptionsOf(current),
          maskedNames: current.reasoning.maskedNames,
        }).pipe(
          map((wording): AutoModeAnswer => ({
            subject: ask.subject,
            askedAtMs: Date.now(),
            request: prepared.request,
            outcome: outcomeOf({ wording, prepared, maskedNames: current.reasoning.maskedNames }),
          })),
        );
      }),
      switchMap((answer) => withIssueState$(answer)),
      switchMap((answer) =>
        heldAnswers$(ask.day).pipe(
          tap((held) => {
            const key = autoModeSubjectKey(ask.subject);

            if (held.some((entry) => autoModeSubjectKey(entry.subject) === key)) {
              approvals.revise((queue) => withAutoModeSubjectItemsExpired(queue, ask));
            }
          }),
          map((held) => {
            const key = autoModeSubjectKey(ask.subject);
            const reAsk =
              ask.subject.kind === 'call' && held.some((entry) => autoModeSubjectKey(entry.subject) === key);

            return reAsk ? { ...answer, transcriptTried: true as const } : answer;
          }),
        ),
      ),
      switchMap((answer) => queued$(ask.day, answer)),
      switchMap((answer) => queuedApply$(ask.day, answer).pipe(map((queued) => ({ answer, queued })))),
      switchMap(({ answer, queued }) =>
        dayReview
          .changeDay$(ask.day, (edits) => withAutoModeAnswer(edits, answer))
          .pipe(
            switchMap(() => applyAnswer$(ask.day, answer)),
            map(() => {
              const { outcome } = answer;

              if (outcome.kind !== 'match') return undefined;
              if (outcome.gone) return `Jira no longer holds ${outcome.issueKey}, nothing applied`;
              if (outcome.done)
                return `${outcome.issueKey} is done, ${queued ? 'waits for your approval' : 'left to you'}`;
              if (outcome.listOnly && queued)
                return `${outcome.issueKey} waits for your approval: no evidence names it`;

              return undefined;
            }),
          ),
      ),
    );

  const issueSummaries$ = (keys: readonly string[]): Observable<Record<string, string>> =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials ? fetchJiraIssues$({ transport: ports.transport, credentials, keys: [...keys] }) : of([]),
      ),
      map((issues) => Object.fromEntries(issues.map((issue) => [issue.key, issue.summary]))),
      catchError(() => of({})),
    );

  const doneKeys$ = (keys: readonly string[]): Observable<Set<string>> =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials
          ? fetchJiraDoneIssueKeys$({ transport: ports.transport, credentials, keys })
          : of(new Set<string>()),
      ),
      catchError(() => of(new Set<string>())),
    );

  const issueSummary$ = (issueKey: string): Observable<string | undefined> =>
    issueSummaries$([issueKey]).pipe(map((summaries) => summaries[issueKey]));

  const queuedResolve$ = (options: { day: string; dispute: AutoModeDispute; label: string }): Observable<boolean> => {
    const { day, dispute, label } = options;
    const request = autoDisputeResolveRequest({ day, dispute, label, classes: settings.settings().actionClasses });

    if (!request) return of(false);

    return approvals
      .enqueue$({ request, client: AUTO_MODE_CLIENT, target: autoModeResolveTarget(day, dispute.rowId) })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  };

  const disputeDetail = (options: { dispute: AutoModeDispute; otherLabel: string; queued: boolean }) => {
    const { dispute, otherLabel, queued } = options;
    const { answer } = dispute;

    if (!answer) return 'The ask failed; the dispute stays as it is.';

    const done = autoDisputeDoneChoice(dispute);

    if (done) return `${done} is done, left to you: ${answer.reason}`;

    const did = {
      keep: `Keeps ${dispute.booked}`,
      use: `Takes ${otherLabel} over ${dispute.booked}`,
      unsure: 'Unsure, leaves the dispute to you',
    }[answer.choice];

    return `${did}${queued ? ', waits for your approval' : ''}: ${answer.reason}`;
  };

  const settle$ = (day: string, row: ReviewedRow): Observable<string> => {
    const other = disputedTargetOf(row);
    const booked = row.issueKey;

    if (!other || !booked) return EMPTY;

    const current = settings.settings();
    const maskedNames = current.reasoning.maskedNames;
    const rowId = autoDescriptionRowId(row);
    const label = row.laneKey ? streamKeyLabel(row.laneKey) : booked;

    const keys = other.kind === 'issue' ? [booked, other.issueKey] : [booked];

    return forkJoin([issueSummaries$(keys), doneKeys$(keys)]).pipe(
      switchMap(([summaries, done]) => {
        const request = autoDisputeRequest({ row, other, summaries, standIns: current.standIns, maskedNames });

        return resolveDisputeWithAgent$({
          runner,
          request,
          options: reasoningOptionsOf(current),
          maskedNames,
        }).pipe(
          map((answer): AutoModeDispute => ({
            rowId,
            askedAtMs: Date.now(),
            booked,
            other,
            request,
            ...(answer ? { answer } : {}),
            ...(done.size ? { doneKeys: keys.filter((key) => done.has(key)) } : {}),
          })),
        );
      }),
      switchMap((dispute) =>
        queuedResolve$({ day, dispute, label }).pipe(
          switchMap((queued) =>
            dayReview
              .changeDay$(day, (edits) => withAutoModeDispute(edits, dispute))
              .pipe(
                map(() => {
                  if (enabled() && dayReview.dayKey() === day) dayReview.applyAutoModeDisputes(disputeAppliesOn(day));

                  return disputeDetail({ dispute, otherLabel: otherLabelOf(row), queued });
                }),
              ),
          ),
        ),
      ),
    );
  };

  const describe$ = (day: string, ask: AutoDescriptionAsk): Observable<void> => {
    const issueKey = ask.rows[0]?.issueKey;

    return (issueKey ? issueSummary$(issueKey) : of(undefined)).pipe(
      switchMap((issueSummary) => {
        const current = settings.settings();
        const maskedNames = current.reasoning.maskedNames;
        const request = autoDescriptionRequest({ rows: ask.rows, issueSummary, maskedNames });

        return writeWorklogWithAgent$({
          runner,
          request,
          options: reasoningOptionsOf(current),
          maskedNames,
        }).pipe(
          switchMap((description) =>
            dayReview.changeDay$(day, (edits) =>
              withAutoModeDescription({
                edits,
                rows: ask.rows,
                answer: {
                  rowId: ask.id,
                  askedAtMs: Date.now(),
                  request,
                  ...(description ? { description } : {}),
                },
              }),
            ),
          ),
        );
      }),
    );
  };

  const describeLabelOf = (ask: AutoDescriptionAsk) => {
    const issueKey = ask.rows[0]?.issueKey ?? 'a row';

    return ask.id === autoDescriptionTicketId(issueKey)
      ? `Describes the day's worklogs of ${issueKey}`
      : `Describes the worklog of ${issueKey}`;
  };

  const queueDescribe = (options: {
    day: string;
    ask: AutoDescriptionAsk;
    still: () => AutoDescriptionAsk | undefined;
  }) =>
    queue({
      key: `${options.day}|description:${options.ask.id}`,
      day: options.day,
      label: describeLabelOf(options.ask),
      stillNeeded: () => !!options.still(),
      work: () => {
        const held = options.still();

        return held ? describe$(options.day, held) : EMPTY;
      },
    });

  const queue = (job: Job) => {
    if (pending().has(job.key)) return false;

    pending.update((keys) => new Set([...keys, job.key]));
    jobs$.next(job);

    return true;
  };

  const askKeyOf = (day: string, subject: AutoModeSubject) => `${day}|${autoModeSubjectKey(subject)}`;

  const askLabelOf = (subject: AutoModeSubject) => `Asks about ${labelOf(subject) || 'unnamed work'}`;

  const queueAsk = (options: {
    day: string;
    subject: AutoModeSubject;
    stillNeeded: () => boolean;
    evidence$?: Observable<AskEvidence>;
  }) => {
    const { day, subject } = options;
    const evidence$ = options.evidence$ ?? screenEvidence$;

    return queue({
      key: askKeyOf(day, subject),
      day,
      label: askLabelOf(subject),
      stillNeeded: options.stillNeeded,
      work: () => answer$({ day, subject, evidence$ }),
    });
  };

  const askFor$ = (options: { day: string; subject: AutoModeSubject }): Observable<AgentApiAutoModeAsk> => {
    const { day, subject } = options;

    if (!settings.settings().reasoning.enabled) {
      return throwError(() => new Error('The model is switched off in Timetrack Settings, so auto mode cannot ask.'));
    }

    return agentDay.askEvidence$(day).pipe(
      take(1),
      map((evidence) => {
        const refusal = autoModeAskRefusal({ subject, day, standIns: settings.settings().standIns, ...evidence });

        if (refusal) throw new Error(`${refusal} Nothing was asked.`);

        const queued = queueAsk({
          day,
          subject,
          stillNeeded: () => true,
          evidence$: agentDay.askEvidence$(day).pipe(
            map((current): AskEvidence => ({
              contexts: current.contexts,
              rows: current.dayRows,
              reviewed: current.rows,
              workFacts: workFactsOf({
                day,
                contexts: current.contexts,
                reviewed: current.rows,
                events: current.events,
              }),
            })),
          ),
        });

        return { status: queued ? 'queued' : 'asking', day, subject, label: askLabelOf(subject) };
      }),
    );
  };

  // `concatMap`: one CLI at a time, the same guard the press has against spawning a second one.
  // `observeOn`: the ask is checked again once the naming passes of the same flush have written, so a
  // context the app is naming with a stand-in right now is never asked about as well.
  jobs$
    .pipe(
      observeOn(asyncScheduler),
      concatMap((job) =>
        defer(() => {
          if (!job.stillNeeded()) return EMPTY;

          const id = began(job);
          let detail: string | undefined;

          return job.work().pipe(
            tap({
              next: (value) => {
                if (typeof value === 'string') detail = value;
              },
              complete: () => ended(id, { state: 'done', ...(detail ? { detail } : {}) }),
              error: (error: unknown) =>
                ended(id, { state: 'failed', error: error instanceof Error ? error.message : String(error) }),
            }),
          );
        }).pipe(
          catchError(() => EMPTY),
          finalize(() => pending.update((keys) => new Set([...keys].filter((key) => key !== job.key)))),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const day = dayReview.dayKey();
    const subjects = askedNow(day);

    untracked(() => {
      for (const subject of subjects) {
        queueAsk({
          day,
          subject,
          stillNeeded: () => askedNow(day).some((held) => autoModeSubjectKey(held) === autoModeSubjectKey(subject)),
        });
      }
    });
  });

  const offScreenEvidence$ = (day: string) =>
    agentDay.askEvidence$(day).pipe(
      map((current): AskEvidence => ({
        contexts: current.contexts,
        rows: current.dayRows,
        reviewed: current.rows,
        workFacts: workFactsOf({ day, contexts: current.contexts, reviewed: current.rows, events: current.events }),
      })),
    );

  /**
   * Today, read without the screen: the stand-in pass and the asks the day screen runs for the day on
   * screen. Without it a reviewer left on another day stops auto mode and the stand-ins for today.
   */
  const offScreenPass$ = (day: string): Observable<unknown> =>
    forkJoin({ evidence: agentDay.askEvidence$(day).pipe(take(1)), answers: heldAnswers$(day) }).pipe(
      switchMap(({ evidence, answers }) => {
        const current = settings.settings();
        const askedWithout =
          current.transcribeCalls && current.reasoning.autoModeTranscripts
            ? askedCallRowIds(answers, evidence.rows)
            : [];

        return transcribedCallsOf$({
          rowIds: askedWithout,
          evidence: { contexts: evidence.contexts, rows: evidence.dayRows, reviewed: evidence.rows },
        }).pipe(map((transcribed) => ({ evidence, answers, transcribed })));
      }),
      tap(({ evidence, answers, transcribed }) => {
        runStandInPass({
          settings,
          day,
          contexts: evidence.contexts,
          unattributed: evidence.unattributed,
          events: evidence.events,
          links: projectLinks(),
          repoRoots: git.discovery()?.repos,
          offeredCheckouts: evidence.offeredCheckouts,
          standInIds: evidence.rows.flatMap((row) => (row.standInId ? [row.standInId] : [])),
          streams: evidence.streams,
        });

        const current = settings.settings();
        const subjects = autoModeAsks({
          enabled: enabled(),
          day,
          today: today(),
          nowMs: Date.now(),
          contexts: evidence.contexts,
          ruledContextIds: new Set(
            evidence.contexts
              .filter((context) => matchAttributionRule({ context: context.context, rules: current.attributionRules }))
              .map((context) => context.id),
          ),
          standIns: current.standIns,
          rows: evidence.rows,
          answers,
          evidence: {
            unattributed: evidence.unattributed,
            config: gitFlowConfigFor(current),
            maskedNames: current.reasoning.maskedNames,
            workFacts: workFactsOf({
              day,
              contexts: evidence.contexts,
              reviewed: evidence.rows,
              events: evidence.events,
            }),
          },
          approvals: approvals.items(),
          transcribedCalls: transcribed,
        });

        for (const subject of subjects) {
          queueAsk({
            day,
            subject,
            stillNeeded: () => enabled() && dayReview.dayKey() !== day,
            evidence$: offScreenEvidence$(day),
          });
        }
      }),
      catchError(() => EMPTY),
    );

  const offScreenDay = computed(() => {
    minuteTick();

    const day = today();

    return enabled() && approvals.isLoaded() && dayReview.dayKey() !== day ? day : null;
  });

  toObservable(offScreenDay)
    .pipe(
      switchMap((day) => (day ? timer(0, OFF_SCREEN_TICK_MS).pipe(exhaustMap(() => offScreenPass$(day))) : EMPTY)),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const day = dayReview.dayKey();

    if (!approvals.isLoaded() || !dayReview.autoAnswers() || dayReview.isLoading()) return;
    if (!dayReview.deterministic() || !dayReview.namingSettled()) return;

    const ruled = dayReview.rulesByContext();
    const openContextIds = new Set(
      dayReview
        .unnamed()
        .filter((context) => !ruled.has(context.id))
        .map((context) => context.id),
    );

    const current = settings.settings();
    const workFacts = screenWorkFacts() ?? new Map<string, WorkFacts>();
    const textless = {
      day,
      contexts: dayReview.unnamed(),
      standIns: current.standIns,
      bands: dayReview.rows(),
      unattributed: dayReview.deterministic()?.unattributed ?? [],
      config: gitFlowConfigFor(current),
    };

    untracked(() =>
      approvals.revise((queue) =>
        withUnnamedSubjectItemsExpired(
          withTextlessSubjectItemsExpired(withNamedContextItemsExpired(queue, { day, openContextIds }), textless),
          { day, workFacts },
        ),
      ),
    );
  });

  effect(() => {
    const day = dayReview.dayKey();
    const asks = describedNow(day);

    untracked(() => {
      for (const ask of asks) {
        queueDescribe({ day, ask, still: () => describedNow(day).find((held) => held.id === ask.id) });
      }
    });
  });

  const pastDayHeld$ = (day: string): Observable<boolean> =>
    forkJoin({
      ledger: ledgerEntriesForRange$({ ledger: ports.ledger, day, boundary: dayBoundaryOf(settings.settings()) }),
      coverage: ports.coverage.forDay$(day),
    }).pipe(
      map(({ ledger, coverage }) => isDayHeldByTempo({ ledger, coverage })),
      catchError(() => of(true)),
    );

  const describedPastDays = new Set<string>();

  const offScreenDescribeAsks$ = (day: string): Observable<AutoDescriptionAsk[]> =>
    forkJoin({
      evidence: agentDay.askEvidence$(day).pipe(take(1)),
      edits: ports.review.editsFor$(day).pipe(take(1)),
      heldByTempo: pastDayHeld$(day),
    }).pipe(
      map(({ evidence, edits, heldByTempo }) =>
        autoDescriptionAsks({
          enabled: enabled(),
          day,
          today: today(),
          nowMs: Date.now(),
          classes: settings.settings().actionClasses,
          rows: evidence.rows,
          answers: edits?.autoDescriptions ?? [],
          maskedNames: settings.settings().reasoning.maskedNames,
          backgroundProjects: settings.settings().backgroundProjects,
          heldByTempo,
        }),
      ),
    );

  /**
   * The day that just ended, read without the screen once its tickets wait for their description.
   * A pass that finds nothing left to ask ends the reads of that day for this app session.
   */
  const offScreenPastPass$ = (day: string): Observable<unknown> =>
    offScreenDescribeAsks$(day).pipe(
      tap((asks) => {
        if (!asks.length) describedPastDays.add(day);

        for (const ask of asks) {
          queueDescribe({
            day,
            ask,
            still: () => (enabled() && dayReview.dayKey() !== day ? ask : undefined),
          });
        }
      }),
      catchError(() => EMPTY),
    );

  const offScreenPastDay = computed(() => {
    minuteTick();

    const day = shiftDayKey(today(), -1);

    return enabled() && dayReview.dayKey() !== day && !describedPastDays.has(day) ? day : null;
  });

  toObservable(offScreenPastDay)
    .pipe(
      switchMap((day) =>
        day
          ? timer(0, OFF_SCREEN_TICK_MS).pipe(
              takeWhile(() => !describedPastDays.has(day)),
              exhaustMap(() => offScreenPastPass$(day)),
            )
          : EMPTY,
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const day = dayReview.dayKey();
    const rests = hidesNow(day);

    untracked(() => {
      for (const row of rests) {
        queue({
          key: `${day}|hide:${row.id}`,
          day,
          label: 'Suggests to hide an off-topic call rest',
          stillNeeded: () => hidesNow(day).some((held) => held.id === row.id),
          work: () => suggestHide$(day, row),
        });
      }
    });
  });

  effect(() => {
    const day = dayReview.dayKey();
    const rows = disputesNow(day);

    untracked(() => {
      for (const row of rows) {
        const rowId = autoDescriptionRowId(row);
        const still = () => disputesNow(day).find((held) => autoDescriptionRowId(held) === rowId);

        queue({
          key: `${day}|dispute:${rowId}|${row.issueKey ?? ''}|${otherLabelOf(row)}`,
          day,
          label: `Settles ${row.issueKey ?? 'a band'} or ${otherLabelOf(row)}`,
          stillNeeded: () => !!still(),
          work: () => {
            const held = still();

            return held ? settle$(day, held) : EMPTY;
          },
        });
      }
    });
  });

  effect(() => {
    if (!enabled() || !dayReview.isToday()) return;

    dayReview.autoAnswers();
    dayReview.rows();
    approvals.items();
    settings.settings();

    untracked(() => {
      dayReview.applyAutoModeNames(appliesOn(dayReview.dayKey()));
      dayReview.applyAutoModeDisputes(disputeAppliesOn(dayReview.dayKey()));
    });
  });

  approvals.approved$
    .pipe(
      concatMap(({ id, request }) => {
        if (isAgentApiRequest(request)) return EMPTY;
        if (request.op === 'autoMode.hide') return hideApproved$({ id, request });

        if (request.op === 'autoMode.resolve') {
          approvals.finish(id, { ok: true, value: { rowId: request.rowId, choice: request.choice } });

          return EMPTY;
        }

        return issueState$(request.issueKey).pipe(
          map((state) => {
            const refusal =
              state === 'gone'
                ? `Jira no longer holds ${request.issueKey}: it was deleted or moved to another project.`
                : state === 'done' && !request.done
                  ? `${request.issueKey} is done in Jira now. Ask auto mode again.`
                  : undefined;

            if (refusal) {
              approvals.finish(id, { ok: false, message: refusal });

              return;
            }

            approvals.finish(id, { ok: true, value: { issueKey: request.issueKey } });

            if (request.subject.kind === 'stand-in') {
              standInStore.resolve({ id: request.subject.standInId, issueKey: request.issueKey, source: 'auto' });
            }
          }),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  const created = computed(() => {
    const answers = dayReview.autoAnswers();

    minuteTick();

    if (!answers) return [];

    const day = dayReview.dayKey();

    return autoModeCreatedKeys({ answers, approvals: approvals.items() }).map((entry) => ({ ...entry, day }));
  });

  toObservable(created)
    .pipe(
      concatMap((entries) => from(entries)),
      concatMap((entry) =>
        dayReview
          .changeDay$(entry.day, (edits) => withAutoModeCreated(edits, entry))
          .pipe(
            tap(() => {
              const { subject } = entry.answer;

              if (subject.kind === 'stand-in') {
                standInStore.resolve({ id: subject.standInId, issueKey: entry.issueKey, source: 'auto' });
              } else if (enabled() && dayReview.isToday()) {
                dayReview.applyAutoModeNames(appliesOn(dayReview.dayKey()));
              }
            }),
            catchError(() => EMPTY),
          ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  const anonymousReport = (focusRowId?: string, options: { anonymize?: boolean; inputs?: unknown } = {}) => {
    const day = dayReview.dayKey();

    return anonymousDayReport({
      day,
      today: today(),
      screenDay: day,
      generatedAt: new Date(),
      ...options,
      ...(focusRowId ? { focusRowId } : {}),
      flags: {
        windowLocked: windowLock.isLocked(),
        tempoHistory: recurring.state().state,
        epicsSettled: epics.settledFor(day),
        discoveryAnswered: !!git.discovery(),
      },
      settings: settings.settings(),
      links: projectLinks(),
      repoRoots: git.discovery()?.repos,
      stream: dayReview.day(),
      contexts: dayReview.unnamed(),
      rows: dayReview.rows(),
      offeredCheckouts: dayReview.namingOffers().map((offer) => offer.repoPath),
      answers: dayReview.autoAnswers() ?? [],
      approvals: approvals.items(),
      activity: activity(),
    });
  };

  const copyAnonymousReport = (focusRowId?: string) => {
    const text = JSON.stringify(anonymousReport(focusRowId), null, 2);

    defer(() => from(navigator.clipboard.writeText(text)))
      .pipe(
        map(() => true),
        catchError(() => of(false)),
        tap((ok) => reportCopy.set({ ok, atMs: Date.now() })),
      )
      .subscribe();
  };

  const saveReport$ = (options: { anonymize: boolean; includeInputs: boolean }) => {
    const day = dayReview.dayKey();
    const inputs$: Observable<unknown> =
      options.includeInputs && !options.anonymize ? agentDay.inputs$(day).pipe(take(1)) : of(undefined);

    return inputs$.pipe(
      switchMap((inputs) =>
        ports.reportFile.save$({
          suggestedName: `timetrack-${options.anonymize ? 'anonymous' : 'debug'}-report-${day}.json`,
          text: JSON.stringify(anonymousReport(undefined, { anonymize: options.anonymize, inputs }), null, 2),
        }),
      ),
    );
  };

  return {
    /** Whether auto mode runs: it needs the suggestions switch as well as its own. */
    enabled,
    /** The job auto mode runs now, if any. */
    running: computed(() => activity().find((entry) => entry.state === 'running')),
    /** The jobs that wait for their turn or run now. */
    queuedCount: computed(() => pending().size),
    /** Whether the model may be asked at all, which a press of "Ask auto mode again" needs. */
    canAsk: computed(() => settings.settings().reasoning.enabled && !windowLock.isLocked()),
    /** What "Ask auto mode again" on a row of the day on screen asks about, or `null` where it is not offered. */
    reaskSubjectOf: (row: ReviewedRow) =>
      autoModeReaskSubjectOf({
        row,
        day: dayReview.dayKey(),
        contexts: dayReview.unnamed(),
        ruledContextIds: new Set(dayReview.rulesByContext().keys()),
        unattributed: dayReview.deterministic()?.unattributed ?? [],
        standIns: settings.settings().standIns,
      }),
    /** Whether an ask about the subject waits or runs on the day on screen. */
    isAsking: (subject: AutoModeSubject) => pending().has(askKeyOf(dayReview.dayKey(), subject)),
    /**
     * Asks the model about one subject of the day on screen again, whether or not auto mode is on and
     * whatever day it is: the press is the consent. The new answer replaces the stored one.
     */
    askAgain: (subject: AutoModeSubject) => {
      const day = dayReview.dayKey();

      queueAsk({ day, subject, stillNeeded: () => dayReview.dayKey() === day });
    },
    askFor$,
    /** The jobs auto mode ran in this app session, newest first. */
    activity: activity.asReadonly(),
    /**
     * Copies what the stand-in pass and auto mode decided on the day on screen, with every name replaced
     * by a placeholder, to the clipboard. `focusRowId` marks the row it was copied from.
     */
    copyAnonymousReport,
    /** How the last copy went, for the button that pressed it to say so. */
    reportCopy: reportCopy.asReadonly(),
    saveReport$,
    /** The model calls auto mode made in this app session, newest first: what was sent and what came back. */
    modelCalls: modelCalls.asReadonly(),
    /** What auto mode did on the day on screen, read from the stored answers, rows, stand-ins and queue. */
    readout: computed(() => {
      const edits = dayReview.storedEdits();

      if (!edits) return [];

      return autoModeReadout({
        day: dayReview.dayKey(),
        edits,
        approvals: approvals.items(),
        classes: settings.settings().actionClasses,
        standIns: settings.settings().standIns,
        rows: dayReview.rows(),
      });
    }),
  };
});

export const injectAutoMode = /* @__PURE__ */ toInjectFn(AUTO_MODE_DEF);
