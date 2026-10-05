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
  AutoModeSubject,
  TicketWording,
  ReviewedRow,
  TicketWritingRequest,
  actionClassOf,
  autoModeActs,
  autoModeApplies,
  autoModeApplyRequest,
  autoModeApplyTarget,
  autoModeApprovalTarget,
  autoModeAsks,
  autoModeCreateRequest,
  autoModeContextLabel,
  autoModeCreatedKeys,
  autoModeHideAsks,
  autoModeHideRequest,
  autoModeHideTarget,
  autoModeQueuedAnswer,
  autoModeReadout,
  autoModeReaskSubjectOf,
  autoModeSubjectKey,
  autoModeSubjectRequest,
  autoDescriptionAsks,
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
  dayBoundaryOf,
  favoriteProjectKeys,
  fetchJiraDoneIssueKeys$,
  fetchJiraIssues$,
  gitFlowConfigFor,
  isAgentApiRequest,
  inferTicketProjectKey,
  localDayKey,
  reasoningOptionsOf,
  readJiraCredentials$,
  withAutoModeAnswer,
  withAutoModeSubjectItemsExpired,
  withNamedContextItemsExpired,
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
  finalize,
  forkJoin,
  from,
  interval,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectAgentDay } from '../agent/agent-day';
import { injectApprovalQueue } from '../agent/approval-queue';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectProjectLinks } from '../project-links';
import { injectTimetrackSettings } from '../settings/settings';
import { injectWindowLock } from '../window-lock';
import { injectDayReview } from './day-review';
import { ProjectIssues, matchCandidatesOf, readProjectIssues$ } from './project-issues';

/** How often a row's settle time is checked again: a row settles by the clock, not by a change. */
const DESCRIPTION_TICK_MS = 60_000;

type Ask = { day: string; subject: AutoModeSubject };

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

/** What one ask sends: the payload, and the project a new ticket would be filed in. */
type Prepared = { request: TicketWritingRequest; projectKey?: string };

const outcomeOf = (options: { wording: TicketWording | null; projectKey?: string }): AutoModeOutcome => {
  const { wording, projectKey } = options;

  if (!wording) return { kind: 'failed' };
  if (wording.existingKey) {
    return {
      kind: 'match',
      issueKey: wording.existingKey,
      ...(wording.existingReason ? { reason: wording.existingReason } : {}),
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
  const minuteTick = toSignal(interval(DESCRIPTION_TICK_MS), { initialValue: -1 });

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

  const labelOf = (subject: AutoModeSubject) =>
    subject.kind === 'context'
      ? autoModeContextLabel(subject.contextId)
      : (settings.settings().standIns.find((entry) => entry.id === subject.standInId)?.name ?? '');

  const today = () => localDayKey(new Date(), dayBoundaryOf(settings.settings()));

  const askedNow = (day: string) => {
    const answers = dayReview.autoAnswers();

    if (!answers || dayReview.isLoading() || !dayReview.deterministic() || !dayReview.namingSettled()) return [];
    if (dayReview.dayKey() !== day) return [];

    const current = settings.settings();

    return autoModeAsks({
      enabled: enabled(),
      day,
      today: today(),
      contexts: dayReview.unnamed(),
      ruledContextIds: new Set(dayReview.rulesByContext().keys()),
      standIns: current.standIns,
      rows: dayReview.rows(),
      answers,
      evidence: {
        unattributed: dayReview.deterministic()?.unattributed ?? [],
        config: gitFlowConfigFor(current),
        maskedNames: current.reasoning.maskedNames,
      },
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

  const issues$ = (projectKey: string | undefined): Observable<ProjectIssues | null> =>
    projectKey
      ? recurring.settled$.pipe(
          switchMap(() =>
            readProjectIssues$({
              ports,
              settings: settings.settings(),
              projectKey,
              loggedKeys: recurring.loggedIssues().map((issue) => issue.issueKey),
            }),
          ),
          catchError(() => of(null)),
        )
      : of(null);

  const projectKeyOf = (subject: AutoModeSubject) => {
    const current = settings.settings();

    if (subject.kind === 'stand-in') {
      return current.standIns.find((entry) => entry.id === subject.standInId)?.projectKey;
    }

    const context = dayReview.unnamed().find((entry) => entry.id === subject.contextId);
    const deterministic = dayReview.deterministic();

    if (!context || !deterministic) return undefined;

    return (
      inferTicketProjectKey({
        context: context.context,
        rules: current.attributionRules,
        proposals: deterministic.proposals,
        projectKeys: favoriteProjectKeys(current),
        links: projectLinks(),
      }) ?? undefined
    );
  };

  const requestOf = (subject: AutoModeSubject, issues: ProjectIssues | null) => {
    const current = settings.settings();
    const deterministic = dayReview.deterministic();

    if (subject.kind === 'context' && !deterministic) return null;

    return autoModeSubjectRequest({
      subject,
      contexts: dayReview.unnamed(),
      unattributed: deterministic?.unattributed ?? [],
      standIns: current.standIns,
      config: gitFlowConfigFor(current),
      maskedNames: current.reasoning.maskedNames,
      parents: issues?.parents ?? [],
      issues: issues ? matchCandidatesOf(issues) : [],
    });
  };

  const prepare$ = (subject: AutoModeSubject): Observable<Prepared | null> => {
    if (!requestOf(subject, null)) return of(null);

    const projectKey = projectKeyOf(subject);

    return issues$(projectKey).pipe(
      map((issues) => {
        const request = requestOf(subject, issues);

        return request ? { request, ...(projectKey ? { projectKey } : {}) } : null;
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

  const applyAnswer = (day: string, answer: AutoModeAnswer) => {
    const { subject, outcome } = answer;

    if (subject.kind === 'context') {
      dayReview.applyAutoModeNames(appliesOn(dayReview.dayKey()));

      return;
    }

    if (outcome.kind === 'match') {
      if (appliesOn(day)(answer)) {
        settings.resolveStandIn({ id: subject.standInId, issueKey: outcome.issueKey, source: 'auto' });
      }
    } else if (
      outcome.kind === 'draft' &&
      outcome.parentKey &&
      actionClassOf('autoMode.apply', settings.settings().actionClasses) === 'local'
    ) {
      settings.setStandInParent({ id: subject.standInId, parentKey: outcome.parentKey, source: 'auto' });
    }
  };

  const withDone$ = (answer: AutoModeAnswer): Observable<AutoModeAnswer> => {
    const { outcome } = answer;

    if (outcome.kind !== 'match') return of(answer);

    return doneKeys$([outcome.issueKey]).pipe(
      map((done) => (done.has(outcome.issueKey) ? { ...answer, outcome: { ...outcome, done: true } } : answer)),
    );
  };

  const answer$ = (ask: Ask): Observable<string | void> =>
    prepare$(ask.subject).pipe(
      switchMap((prepared) => {
        if (!prepared) return EMPTY;

        const current = settings.settings();

        return writeTicketWithAgent$({
          runner: ports.processes,
          request: prepared.request,
          options: reasoningOptionsOf(current),
          maskedNames: current.reasoning.maskedNames,
        }).pipe(
          map((wording): AutoModeAnswer => ({
            subject: ask.subject,
            askedAtMs: Date.now(),
            request: prepared.request,
            outcome: outcomeOf({ wording, projectKey: prepared.projectKey }),
          })),
        );
      }),
      switchMap((answer) => withDone$(answer)),
      tap(() => {
        if (dayReview.dayKey() !== ask.day) return;

        const key = autoModeSubjectKey(ask.subject);

        if (dayReview.autoAnswers()?.some((held) => autoModeSubjectKey(held.subject) === key)) {
          approvals.revise((queue) => withAutoModeSubjectItemsExpired(queue, ask));
        }
      }),
      switchMap((answer) => queued$(ask.day, answer)),
      switchMap((answer) => queuedApply$(ask.day, answer).pipe(map((queued) => ({ answer, queued })))),
      switchMap(({ answer, queued }) =>
        dayReview
          .changeDay$(ask.day, (edits) => withAutoModeAnswer(edits, answer))
          .pipe(
            map(() => {
              applyAnswer(ask.day, answer);

              if (answer.outcome.kind !== 'match' || !answer.outcome.done) return undefined;

              return `${answer.outcome.issueKey} is done, ${queued ? 'waits for your approval' : 'left to you'}`;
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
          runner: ports.processes,
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

  const describe$ = (day: string, row: ReviewedRow): Observable<void> =>
    (row.issueKey ? issueSummary$(row.issueKey) : of(undefined)).pipe(
      switchMap((issueSummary) => {
        const current = settings.settings();
        const maskedNames = current.reasoning.maskedNames;
        const request = autoDescriptionRequest({ row, issueSummary, maskedNames });

        return writeWorklogWithAgent$({
          runner: ports.processes,
          request,
          options: reasoningOptionsOf(current),
          maskedNames,
        }).pipe(
          switchMap((description) =>
            dayReview.changeDay$(day, (edits) =>
              withAutoModeDescription({
                edits,
                row,
                answer: {
                  rowId: autoDescriptionRowId(row),
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

  const queue = (job: Job) => {
    if (pending().has(job.key)) return;

    pending.update((keys) => new Set([...keys, job.key]));
    jobs$.next(job);
  };

  const askKeyOf = (day: string, subject: AutoModeSubject) => `${day}|${autoModeSubjectKey(subject)}`;

  const queueAsk = (options: { day: string; subject: AutoModeSubject; stillNeeded: () => boolean }) => {
    const { day, subject } = options;

    queue({
      key: askKeyOf(day, subject),
      day,
      label: `Asks about ${labelOf(subject) || 'unnamed work'}`,
      stillNeeded: options.stillNeeded,
      work: () => answer$({ day, subject }),
    });
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

    untracked(() => approvals.revise((queue) => withNamedContextItemsExpired(queue, { day, openContextIds })));
  });

  effect(() => {
    const day = dayReview.dayKey();
    const rows = describedNow(day);

    untracked(() => {
      for (const row of rows) {
        const rowId = autoDescriptionRowId(row);

        const still = () => describedNow(day).find((held) => autoDescriptionRowId(held) === rowId);

        queue({
          key: `${day}|description:${rowId}`,
          day,
          label: `Describes the worklog of ${row.issueKey ?? 'a row'}`,
          stillNeeded: () => !!still(),
          work: () => {
            const held = still();

            return held ? describe$(day, held) : EMPTY;
          },
        });
      }
    });
  });

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

        approvals.finish(id, { ok: true, value: { issueKey: request.issueKey } });

        if (request.subject.kind === 'stand-in') {
          settings.resolveStandIn({ id: request.subject.standInId, issueKey: request.issueKey, source: 'auto' });
        }

        return EMPTY;
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  const created = computed(() => {
    const answers = dayReview.autoAnswers();

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
                settings.resolveStandIn({ id: subject.standInId, issueKey: entry.issueKey, source: 'auto' });
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
    /** The jobs auto mode ran in this app session, newest first. */
    activity: activity.asReadonly(),
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
