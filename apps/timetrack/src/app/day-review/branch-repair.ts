import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  BranchRepairOutcome,
  BranchRepairPlan,
  GitLabCredentials,
  RepairMergeRequest,
  executeBranchRepair$,
  fetchGitLabMergeRequestsForBranch$,
  gitFlowConfigFor,
  isRepairableBranch,
  normalizeGitLabHost,
  parseGitLabRemoteUrl,
  planBranchRepair,
  readGitBranchState$,
  readGitLabCredentials$,
} from '@ethlete/timetrack';
import { Observable, Subject, catchError, exhaustMap, map, of, startWith, switchMap, tap } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

const IDLE = { kind: 'idle' } as const;

/** What repair was opened for: a branch the day observed, and the issue just filed for it. */
export type BranchRepairTarget = { repoPath: string; branch: string; issueKey: string };

type PlanStatus =
  | typeof IDLE
  | { kind: 'reading' }
  | { kind: 'ready'; plan: BranchRepairPlan; project: string | null }
  | { kind: 'failed'; message: string };

type RunStatus = typeof IDLE | { kind: 'running' } | { kind: 'done'; outcome: BranchRepairOutcome };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Makes a branch that named no issue conform, once one has been filed for it.
 *
 * Nothing is decided here: the plan comes from `planBranchRepair` against the repository as it reads
 * right now, and the user sees every step and every refusal before a confirmation runs any of them.
 * The read is redone each time the form opens, because a plan built against a stale working tree is
 * exactly the plan that renames the wrong thing.
 */
const BRANCH_REPAIR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const destroyRef = inject(DestroyRef);
  const settings = injectTimetrackSettings();

  const target = signal<BranchRepairTarget | null>(null);
  const planStatus = signal<PlanStatus>(IDLE);
  const runStatus = signal<RunStatus>(IDLE);
  const reads$ = new Subject<BranchRepairTarget>();
  const runs$ = new Subject<void>();

  /**
   * The merge requests of the branch, when the remote is the configured GitLab instance. A remote
   * this app has no credentials for yields none rather than failing: a repository nobody reviews in
   * GitLab still has a branch worth renaming.
   */
  const mergeRequests$ = (options: {
    remoteUrl: string | undefined;
    branch: string;
  }): Observable<{ mergeRequests: RepairMergeRequest[]; project: string | null }> => {
    const project = options.remoteUrl ? parseGitLabRemoteUrl(options.remoteUrl) : null;
    const configured = settings.settings().gitlab.host;

    if (!project || !configured || normalizeGitLabHost(configured) !== normalizeGitLabHost(project.host)) {
      return of({ mergeRequests: [], project: null });
    }

    return readGitLabCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials: GitLabCredentials | null) =>
        credentials
          ? fetchGitLabMergeRequestsForBranch$({
              transport: ports.transport,
              credentials,
              projectId: project.path,
              branch: options.branch,
            }).pipe(map((mergeRequests) => ({ mergeRequests, project: project.path })))
          : of({ mergeRequests: [], project: null }),
      ),
    );
  };

  reads$
    .pipe(
      switchMap((opened) =>
        readGitBranchState$({ processes: ports.processes, repoPath: opened.repoPath }).pipe(
          switchMap((local) =>
            mergeRequests$({ remoteUrl: local.remote?.url, branch: opened.branch }).pipe(
              map(({ mergeRequests, project }): PlanStatus => ({
                kind: 'ready',
                project,
                plan: planBranchRepair({
                  branch: opened.branch,
                  issueKey: opened.issueKey,
                  config: gitFlowConfigFor(settings.settings()),
                  state: { ...local, mergeRequests },
                }),
              })),
            ),
          ),
          catchError((error: unknown) => of<PlanStatus>({ kind: 'failed', message: messageOf(error) })),
          startWith<PlanStatus>({ kind: 'reading' }),
        ),
      ),
      tap((status) => planStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  // `exhaustMap`: the steps rename a branch and write to GitLab, so a second press while the first
  // run is in flight must not start a second run against a repository the first one is moving.
  runs$
    .pipe(
      exhaustMap(() => {
        const status = planStatus();
        const opened = target();

        if (status.kind !== 'ready' || !opened) return of<RunStatus>(IDLE);

        return readGitLabCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
          switchMap((credentials) =>
            executeBranchRepair$({
              plan: status.plan,
              context: {
                repoPath: opened.repoPath,
                processes: ports.processes,
                transport: ports.transport,
                credentials,
                projectId: status.project ?? undefined,
              },
            }),
          ),
          map((outcome): RunStatus => ({ kind: 'done', outcome })),
          catchError((error: unknown) =>
            of<RunStatus>({
              kind: 'done',
              outcome: { completed: [], failed: { message: messageOf(error) }, undo: [] },
            }),
          ),
          startWith<RunStatus>({ kind: 'running' }),
        );
      }),
      tap((status) => runStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return {
    /** What repair is open for, or nothing when it is closed. */
    target: target.asReadonly(),
    isReading: computed(() => planStatus().kind === 'reading'),
    plan: computed(() => {
      const status = planStatus();

      return status.kind === 'ready' ? status.plan : null;
    }),
    readFailure: computed(() => {
      const status = planStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    isRunning: computed(() => runStatus().kind === 'running'),
    outcome: computed(() => {
      const status = runStatus();

      return status.kind === 'done' ? status.outcome : null;
    }),
    canRun: computed(() => {
      const status = planStatus();

      return status.kind === 'ready' && status.plan.refusals.length === 0 && status.plan.steps.length > 0;
    }),

    /** Whether a branch is worth offering repair for at all, before anything is read. */
    isRepairable: (branch: string | undefined) =>
      !!branch && isRepairableBranch({ branch, config: gitFlowConfigFor(settings.settings()) }),

    open: (opened: BranchRepairTarget) => {
      target.set(opened);
      runStatus.set(IDLE);
      reads$.next(opened);
    },

    close: () => {
      target.set(null);
      planStatus.set(IDLE);
      runStatus.set(IDLE);
    },

    run: () => runs$.next(),
  };
});

export const injectBranchRepair = /* @__PURE__ */ toInjectFn(BRANCH_REPAIR_DEF);
