import { computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AUTO_MODE_CLIENT,
  AgentApproval,
  AutoModeAnswer,
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
  autoModeSubjectKey,
  autoDescriptionAsks,
  autoDescriptionRequest,
  autoDescriptionRowId,
  dayBoundaryOf,
  draftTicket,
  favoriteProjectKeys,
  fetchJiraIssues$,
  gitFlowConfigFor,
  isAgentApiRequest,
  inferTicketProjectKey,
  localDayKey,
  reasoningOptionsOf,
  readJiraCredentials$,
  standInWritingRequest,
  ticketWritingRequest,
  withAutoModeAnswer,
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
  from,
  interval,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectApprovalQueue } from '../agent/approval-queue';
import { injectProjectLinks } from '../project-links';
import { injectTimetrackSettings } from '../settings/settings';
import { injectWindowLock } from '../window-lock';
import { injectDayReview } from './day-review';
import { ProjectIssues, readProjectIssues$ } from './project-issues';

/** How often a row's settle time is checked again: a row settles by the clock, not by a change. */
const DESCRIPTION_TICK_MS = 60_000;

type Ask = { day: string; subject: AutoModeSubject };

type Job = { key: string; day: string; label: string; stillNeeded: () => boolean; work: () => Observable<void> };

/** One job auto mode ran in this app session. Nothing stores it: the per-day readout is the record. */
export type AutoModeActivity = {
  id: number;
  day: string;
  label: string;
  startedAtMs: number;
  endedAtMs?: number;
  state: 'running' | 'done' | 'failed';
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
 * once. A settled code row with a ticket gets a one-line worklog description written as `auto`, once
 * per row, where applying is `local`. The rest band of a call gone off topic waits as an
 * `autoMode.hide` suggestion, once per band.
 */
const AUTO_MODE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const dayReview = injectDayReview();
  const approvals = injectApprovalQueue();
  const projectLinks = injectProjectLinks();
  const windowLock = injectWindowLock();
  const jobs$ = new Subject<Job>();
  const pending = new Set<string>();
  const queuedCount = signal(0);
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

  const ended = (id: number, end: Pick<AutoModeActivity, 'state' | 'error'>) =>
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

  const labelOf = (subject: AutoModeSubject) =>
    subject.kind === 'context'
      ? autoModeContextLabel(subject.contextId)
      : (settings.settings().standIns.find((entry) => entry.id === subject.standInId)?.name ?? '');

  const today = () => localDayKey(new Date(), dayBoundaryOf(settings.settings()));

  const askedNow = (day: string) => {
    const answers = dayReview.autoAnswers();

    if (!answers || dayReview.isLoading() || !dayReview.deterministic() || !dayReview.namingSettled()) return [];
    if (dayReview.dayKey() !== day) return [];

    return autoModeAsks({
      enabled: enabled(),
      day,
      today: today(),
      contexts: dayReview.unnamed(),
      ruledContextIds: new Set(dayReview.rulesByContext().keys()),
      standIns: settings.settings().standIns,
      rows: dayReview.rows(),
      answers,
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
    dayReview
      .editRowsOnDay$({ day: item.request.day, edits: [{ kind: 'hidden', rowId: item.request.rowId, hidden: true }] })
      .pipe(
        map((applied) =>
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
      ? readProjectIssues$({ ports, settings: settings.settings(), projectKey }).pipe(catchError(() => of(null)))
      : of(null);

  const prepare$ = (subject: AutoModeSubject): Observable<Prepared | null> => {
    const current = settings.settings();
    const maskedNames = current.reasoning.maskedNames;

    if (subject.kind === 'stand-in') {
      const standIn = current.standIns.find((entry) => entry.id === subject.standInId);

      if (!standIn) return of(null);

      return issues$(standIn.projectKey).pipe(
        map((issues) => ({
          request: standInWritingRequest({
            standIn,
            parents: issues?.parents ?? [],
            issues: issues?.open ?? [],
            maskedNames,
          }),
          ...(standIn.projectKey ? { projectKey: standIn.projectKey } : {}),
        })),
      );
    }

    const context = dayReview.unnamed().find((entry) => entry.id === subject.contextId);
    const deterministic = dayReview.deterministic();

    if (!context || !deterministic) return of(null);

    const projectKey =
      inferTicketProjectKey({
        context: context.context,
        rules: current.attributionRules,
        proposals: deterministic.proposals,
        projectKeys: favoriteProjectKeys(current),
        links: projectLinks(),
      }) ?? undefined;
    const drafted = draftTicket({
      context,
      unattributed: deterministic.unattributed,
      config: gitFlowConfigFor(current),
    });

    return issues$(projectKey).pipe(
      map((issues) => ({
        request: ticketWritingRequest({
          context,
          notes: drafted.notes,
          parents: issues?.parents ?? [],
          issues: issues?.open ?? [],
          maskedNames,
        }),
        ...(projectKey ? { projectKey } : {}),
      })),
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

  const queuedApply$ = (day: string, answer: AutoModeAnswer): Observable<AutoModeAnswer> => {
    const request = autoModeApplyRequest({
      day,
      answer,
      label: labelOf(answer.subject),
      classes: settings.settings().actionClasses,
    });

    if (!request) return of(answer);

    return approvals
      .enqueue$({ request, client: AUTO_MODE_CLIENT, target: autoModeApplyTarget(day, answer.subject) })
      .pipe(
        map(() => answer),
        catchError(() => of(answer)),
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

  const answer$ = (ask: Ask): Observable<void> =>
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
      switchMap((answer) => queued$(ask.day, answer)),
      switchMap((answer) => queuedApply$(ask.day, answer)),
      switchMap((answer) =>
        dayReview
          .changeDay$(ask.day, (edits) => withAutoModeAnswer(edits, answer))
          .pipe(map(() => applyAnswer(ask.day, answer))),
      ),
    );

  const issueSummary$ = (issueKey: string): Observable<string | undefined> =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials ? fetchJiraIssues$({ transport: ports.transport, credentials, keys: [issueKey] }) : of([]),
      ),
      map((issues) => issues.find((issue) => issue.key === issueKey)?.summary),
      catchError(() => of(undefined)),
    );

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
    if (pending.has(job.key)) return;

    pending.add(job.key);
    queuedCount.set(pending.size);
    jobs$.next(job);
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

          return job.work().pipe(
            tap({
              complete: () => ended(id, { state: 'done' }),
              error: (error: unknown) =>
                ended(id, { state: 'failed', error: error instanceof Error ? error.message : String(error) }),
            }),
          );
        }).pipe(
          catchError(() => EMPTY),
          finalize(() => {
            pending.delete(job.key);
            queuedCount.set(pending.size);
          }),
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
        const ask = { day, subject };

        queue({
          key: `${day}|${autoModeSubjectKey(subject)}`,
          day,
          label: `Asks about ${labelOf(subject) || 'unnamed work'}`,
          stillNeeded: () => askedNow(day).some((held) => autoModeSubjectKey(held) === autoModeSubjectKey(subject)),
          work: () => answer$(ask),
        });
      }
    });
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
    if (!enabled() || !dayReview.isToday()) return;

    dayReview.autoAnswers();
    dayReview.rows();
    approvals.items();
    settings.settings();

    untracked(() => dayReview.applyAutoModeNames(appliesOn(dayReview.dayKey())));
  });

  approvals.approved$
    .pipe(
      concatMap(({ id, request }) => {
        if (isAgentApiRequest(request)) return EMPTY;
        if (request.op === 'autoMode.hide') return hideApproved$({ id, request });

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
    queuedCount: queuedCount.asReadonly(),
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
