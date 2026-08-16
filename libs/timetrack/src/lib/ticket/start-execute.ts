import { GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { GitLabCredentials } from '../gitlab/client';
import { createGitLabMergeRequest$ } from '../gitlab/merge-requests';
import { JiraCredentials, normalizeJiraHost } from '../jira/client';
import { createJiraIssue$ } from '../jira/create';
import { JiraParenting } from '../jira/hierarchy';
import { ProcessSpec, TimetrackProcessRunner, TimetrackTransport } from '../transport/ports';
import { ticketSubjectOf } from './draft';
import {
  WorkStartAction,
  WorkStartPlan,
  WorkStartSpec,
  WorkStartState,
  WorkStartStep,
  draftMergeRequestBody,
  planWorkStart,
} from './start';

/**
 * Everything the plan is a function of. The form shows `planWorkStart(request)` and the run derives
 * the same plan from the same request, so what the user confirmed and what runs cannot diverge.
 */
export type WorkStartRequest = {
  spec: WorkStartSpec;
  config: GitFlowConfig;
  state: WorkStartState;
  /** The GitLab project the remote points at, when it is the configured instance. */
  gitlabProject?: string;
};

export type WorkStartContext = {
  repoPath: string;
  processes: TimetrackProcessRunner;
  transport: TimetrackTransport;
  jira: JiraCredentials | null;
  gitlab: GitLabCredentials | null;
  /** How this Jira instance expresses the relation to a parent issue. */
  parenting?: JiraParenting;
  parentLinkType?: string;
  /** The instance's branch-subject field id, such as `customfield_10057`. */
  subjectField?: string;
};

export type WorkStartOutcome = {
  /** The steps that ran, in order. */
  completed: WorkStartStep[];
  /** The issue that was filed. It outlives a failure of every later step, which is why it is here. */
  issueKey?: string;
  /** The branch the grammar named once the key existed, which the shown plan could only spell `<KEY>`. */
  branch?: string;
  /** The draft merge request that was opened. */
  mergeRequestUrl?: string;
  /** The step that failed and why. A refusal fails with no step. */
  failed?: { step?: WorkStartStep; message: string };
  /**
   * What puts back everything that did run, newest first. Empty after a clean run — a start that
   * finished needs no undo shown, and after a failure this is the only record of how far it got.
   */
  undo: string[];
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const NO_JIRA = 'Jira needs a host, an account email and a token in Settings before an issue can be filed.';
const NO_GITLAB = 'GitLab needs a host and a token in Settings before a merge request can be opened.';

const gitSpec = (options: { repoPath: string; args: string[] }): ProcessSpec => ({
  command: 'git',
  args: options.args,
  cwd: options.repoPath,
});

const git$ = (options: { context: WorkStartContext; args: string[] }): Observable<void> =>
  options.context.processes.run$(gitSpec({ repoPath: options.context.repoPath, args: options.args })).pipe(
    map((result) => {
      if (result.code !== 0)
        throw new Error(result.stderr.trim() || `git ${options.args[0]} exited with ${result.code}`);
    }),
  );

const issueUrlFor = (options: { credentials: JiraCredentials; issueKey: string }) =>
  `${normalizeJiraHost(options.credentials.host)}/browse/${options.issueKey}`;

const fileIssue$ = (options: { request: WorkStartRequest; context: WorkStartContext }): Observable<string> => {
  const { spec } = options.request;
  const { context } = options;

  if (!context.jira) return throwError(() => new Error(NO_JIRA));

  return createJiraIssue$({
    transport: context.transport,
    credentials: context.jira,
    input: {
      projectKey: spec.projectKey.toUpperCase(),
      issueTypeName: spec.issueTypeName,
      summary: spec.summary,
      description: spec.description,
      subject: ticketSubjectOf(spec.summary),
      ...(spec.parentKey ? { parentKey: spec.parentKey } : {}),
      ...(context.parenting ? { parenting: context.parenting } : {}),
      ...(context.parentLinkType ? { parentLinkType: context.parentLinkType } : {}),
      ...(context.subjectField ? { subjectField: context.subjectField } : {}),
    },
  }).pipe(map((created) => created.key));
};

const openMergeRequest$ = (options: {
  action: Extract<WorkStartAction, { kind: 'open-merge-request' }>;
  request: WorkStartRequest;
  context: WorkStartContext;
  issueKey: string;
}): Observable<string | undefined> => {
  const { action, request, context, issueKey } = options;

  if (!context.gitlab || !request.gitlabProject) return throwError(() => new Error(NO_GITLAB));

  return createGitLabMergeRequest$({
    transport: context.transport,
    credentials: context.gitlab,
    projectId: request.gitlabProject,
    sourceBranch: action.sourceBranch,
    targetBranch: action.targetBranch,
    title: action.title,
    description: draftMergeRequestBody({
      issueKey,
      ...(context.jira ? { issueUrl: issueUrlFor({ credentials: context.jira, issueKey }) } : {}),
    }),
  }).pipe(map((mergeRequest) => mergeRequest.webUrl));
};

const runAction$ = (options: {
  action: WorkStartAction;
  request: WorkStartRequest;
  context: WorkStartContext;
  issueKey: string;
}): Observable<string | undefined> => {
  const { action, request, context, issueKey } = options;

  switch (action.kind) {
    case 'create-issue':
      return throwError(() => new Error('The issue is filed before the plan is run again, never as a step.'));
    case 'fetch-base':
      return git$({ context, args: ['fetch', action.remote, action.base] }).pipe(map(() => undefined));
    case 'create-branch':
      return git$({ context, args: ['switch', '-c', action.branch, '--no-track', action.baseRef] }).pipe(
        map(() => undefined),
      );
    case 'push':
      return git$({ context, args: ['push', '-u', action.remote, action.branch] }).pipe(map(() => undefined));
    case 'open-merge-request':
      return openMergeRequest$({ action, request, context, issueKey });
  }
};

const undoFor = (completed: WorkStartStep[]) =>
  [...completed]
    .reverse()
    .map((step) => step.undo)
    .filter((undo): undo is string => !!undo);

const runFrom$ = (options: {
  steps: WorkStartStep[];
  index: number;
  outcome: WorkStartOutcome;
  request: WorkStartRequest;
  context: WorkStartContext;
  issueKey: string;
}): Observable<WorkStartOutcome> => {
  const { steps, index, outcome, request, context, issueKey } = options;
  const step = steps[index];

  if (!step) return of(outcome);

  return runAction$({ action: step.action, request, context, issueKey }).pipe(
    map((mergeRequestUrl) => ({ mergeRequestUrl, message: null as string | null })),
    catchError((error: unknown) => of({ mergeRequestUrl: undefined, message: messageOf(error) })),
    switchMap(({ mergeRequestUrl, message }) =>
      message
        ? of<WorkStartOutcome>({ ...outcome, failed: { step, message }, undo: undoFor(outcome.completed) })
        : runFrom$({
            steps,
            index: index + 1,
            outcome: {
              ...outcome,
              completed: [...outcome.completed, step],
              ...(mergeRequestUrl ? { mergeRequestUrl } : {}),
            },
            request,
            context,
            issueKey,
          }),
    ),
  );
};

const refused = (plan: WorkStartPlan): WorkStartOutcome => ({
  completed: [],
  failed: { message: plan.refusals[0]?.message ?? 'The start was refused.' },
  undo: [],
});

/**
 * Runs a start plan: files the issue, asks the grammar to name the branch now that a key exists, and
 * then creates, pushes and opens the draft merge request one step at a time.
 *
 * The re-plan in the middle is the point. A branch cannot be named before its issue exists, so the
 * plan the user confirmed carried a placeholder — and every refusal that only the real key can decide
 * is only decidable here. A key that turns out to collide stops the run with the issue filed and
 * nothing local touched, which is the cheapest failure available.
 *
 * Nothing reorders or retries. A run that stops half way reports the exact commands that undo what
 * did happen, newest first.
 */
export const executeWorkStart$ = (options: {
  request: WorkStartRequest;
  context: WorkStartContext;
}): Observable<WorkStartOutcome> => {
  const { request, context } = options;
  const shown = planWorkStart(request);

  if (shown.refusals.length > 0) return of(refused(shown));

  return fileIssue$({ request, context }).pipe(
    switchMap((issueKey) => {
      const keyed = planWorkStart({ ...request, issueKey });
      const filed = keyed.steps[0] ?? (shown.steps[0] as WorkStartStep);
      const outcome: WorkStartOutcome = { completed: [filed], issueKey, branch: keyed.branch, undo: [] };

      if (keyed.refusals.length > 0) {
        return of<WorkStartOutcome>({
          ...outcome,
          failed: { message: keyed.refusals[0]?.message ?? 'The start was refused.' },
          undo: undoFor(outcome.completed),
        });
      }

      return runFrom$({ steps: keyed.steps.slice(1), index: 0, outcome, request, context, issueKey });
    }),
    catchError((error: unknown) =>
      of<WorkStartOutcome>({ completed: [], failed: { message: messageOf(error) }, undo: [] }),
    ),
  );
};
