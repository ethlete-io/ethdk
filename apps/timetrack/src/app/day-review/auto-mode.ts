import { computed, effect, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AUTO_MODE_CLIENT,
  AutoModeAnswer,
  AutoModeOutcome,
  AutoModeSubject,
  TicketWording,
  TicketWritingRequest,
  autoModeApprovalTarget,
  autoModeAsks,
  autoModeCreateRequest,
  autoModeCreatedKeys,
  autoModeQueuedAnswer,
  autoModeSubjectKey,
  dayBoundaryOf,
  draftTicket,
  favoriteProjectKeys,
  gitFlowConfigFor,
  inferTicketProjectKey,
  localDayKey,
  reasoningOptionsOf,
  standInWritingRequest,
  ticketWritingRequest,
  withAutoModeAnswer,
  withAutoModeCreated,
  writeTicketWithAgent$,
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

type Ask = { day: string; subject: AutoModeSubject };

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
 * A match is applied as `auto`; a draft waits in the approval queue as a `jira.create`, and the key
 * its approval files is applied the same way. Every answer is stored against the day with the
 * payload it sent, so a band is asked once.
 */
const AUTO_MODE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const dayReview = injectDayReview();
  const approvals = injectApprovalQueue();
  const projectLinks = injectProjectLinks();
  const windowLock = injectWindowLock();
  const asks$ = new Subject<Ask>();
  const pending = new Set<string>();

  const enabled = computed(() => {
    const { reasoning } = settings.settings();

    return reasoning.enabled && reasoning.autoMode && !windowLock.isLocked();
  });

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
      answers,
    });
  };

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

  const applyAnswer = (answer: AutoModeAnswer) => {
    const { subject, outcome } = answer;

    if (subject.kind === 'context') {
      dayReview.applyAutoModeNames();

      return;
    }

    if (outcome.kind === 'match') {
      settings.resolveStandIn({ id: subject.standInId, issueKey: outcome.issueKey, source: 'auto' });
    } else if (outcome.kind === 'draft' && outcome.parentKey) {
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
      switchMap((answer) =>
        dayReview
          .changeDay$(ask.day, (edits) => withAutoModeAnswer(edits, answer))
          .pipe(map(() => applyAnswer(answer))),
      ),
    );

  // `concatMap`: one CLI at a time, the same guard the press has against spawning a second one.
  // `observeOn`: the ask is checked again once the naming passes of the same flush have written, so a
  // context the app is naming with a stand-in right now is never asked about as well.
  asks$
    .pipe(
      observeOn(asyncScheduler),
      concatMap((ask) => {
        const key = `${ask.day}|${autoModeSubjectKey(ask.subject)}`;

        return defer(() => {
          const still = askedNow(ask.day).some(
            (subject) => autoModeSubjectKey(subject) === autoModeSubjectKey(ask.subject),
          );

          return still ? answer$(ask) : EMPTY;
        }).pipe(
          catchError(() => EMPTY),
          finalize(() => pending.delete(key)),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const day = dayReview.dayKey();
    const subjects = askedNow(day);

    untracked(() => {
      for (const subject of subjects) {
        const key = `${day}|${autoModeSubjectKey(subject)}`;

        if (pending.has(key)) continue;

        pending.add(key);
        asks$.next({ day, subject });
      }
    });
  });

  effect(() => {
    if (!enabled() || !dayReview.isToday()) return;

    dayReview.autoAnswers();
    dayReview.rows();

    untracked(() => dayReview.applyAutoModeNames());
  });

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
                dayReview.applyAutoModeNames();
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
  };
});

export const injectAutoMode = /* @__PURE__ */ toInjectFn(AUTO_MODE_DEF);
