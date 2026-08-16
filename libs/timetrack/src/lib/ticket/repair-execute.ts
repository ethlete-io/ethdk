import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { GitLabCredentials } from '../gitlab/client';
import { updateGitLabMergeRequest$ } from '../gitlab/merge-requests';
import { ProcessSpec, TimetrackProcessRunner, TimetrackTransport } from '../transport/ports';
import { BranchRepairAction, BranchRepairPlan, BranchRepairStep } from './repair';

export type BranchRepairOutcome = {
  /** The steps that ran, in order. */
  completed: BranchRepairStep[];
  /** The step that failed and why. A refusal fails with no step. */
  failed?: { step?: BranchRepairStep; message: string };
  /**
   * What puts back everything that did run, newest first. Empty after a clean run — a repair that
   * finished needs no undo shown, and after a failure this is the only record of how far it got.
   */
  undo: string[];
};

export type BranchRepairContext = {
  repoPath: string;
  processes: TimetrackProcessRunner;
  transport: TimetrackTransport;
  credentials: GitLabCredentials | null;
  /** The GitLab project the branch's merge requests live in. Absent when the repo has no project. */
  projectId?: string;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const gitSpec = (options: { repoPath: string; args: string[] }): ProcessSpec => ({
  command: 'git',
  args: options.args,
  cwd: options.repoPath,
});

const git$ = (options: { context: BranchRepairContext; args: string[] }): Observable<void> =>
  options.context.processes.run$(gitSpec({ repoPath: options.context.repoPath, args: options.args })).pipe(
    map((result) => {
      if (result.code !== 0)
        throw new Error(result.stderr.trim() || `git ${options.args[0]} exited with ${result.code}`);
    }),
  );

const mergeRequest$ = (options: {
  context: BranchRepairContext;
  iid: string;
  title?: string;
  targetBranch?: string;
}): Observable<void> => {
  const { context, iid, title, targetBranch } = options;

  if (!context.credentials || !context.projectId) {
    return throwError(
      () => new Error('GitLab needs a host and a token in Settings before a merge request can change.'),
    );
  }

  return updateGitLabMergeRequest$({
    transport: context.transport,
    credentials: context.credentials,
    projectId: context.projectId,
    iid,
    title,
    targetBranch,
  });
};

const runAction$ = (options: { action: BranchRepairAction; context: BranchRepairContext }): Observable<void> => {
  const { action, context } = options;

  switch (action.kind) {
    case 'rename-local':
      return git$({ context, args: ['branch', '-m', action.from, action.to] });
    case 'push':
      return git$({ context, args: ['push', '-u', action.remote, action.branch] });
    case 'delete-remote':
      return git$({ context, args: ['push', action.remote, '--delete', action.branch] });
    case 'retarget':
      return mergeRequest$({ context, iid: action.iid, targetBranch: action.to });
    case 'retitle':
      return mergeRequest$({ context, iid: action.iid, title: action.to });
  }
};

const undoFor = (completed: BranchRepairStep[]) => [...completed].reverse().map((step) => step.undo);

const runFrom$ = (options: {
  steps: BranchRepairStep[];
  index: number;
  completed: BranchRepairStep[];
  context: BranchRepairContext;
}): Observable<BranchRepairOutcome> => {
  const { steps, index, completed, context } = options;
  const step = steps[index];

  if (!step) return of({ completed, undo: [] });

  return runAction$({ action: step.action, context }).pipe(
    map(() => null),
    catchError((error: unknown) => of(messageOf(error))),
    switchMap((failure) =>
      failure
        ? of<BranchRepairOutcome>({ completed, failed: { step, message: failure }, undo: undoFor(completed) })
        : runFrom$({ steps, index: index + 1, completed: [...completed, step], context }),
    ),
  );
};

/**
 * Runs a repair plan, one step at a time, and stops at the first failure.
 *
 * The order the plan sets is the whole safety story, so nothing here reorders or retries: a run that
 * stops half way leaves the old branch and every merge request in place, and reports the exact
 * commands that undo what did happen. A plan carrying any refusal runs nothing at all — the refusals
 * were decided against the repository as it was read, and this is the last place that still knows it.
 */
export const executeBranchRepair$ = (options: {
  plan: BranchRepairPlan;
  context: BranchRepairContext;
}): Observable<BranchRepairOutcome> => {
  const { plan, context } = options;

  if (plan.refusals.length > 0) {
    return of({ completed: [], failed: { message: plan.refusals[0]?.message ?? 'The repair was refused.' }, undo: [] });
  }

  return runFrom$({ steps: plan.steps, index: 0, completed: [], context });
};
