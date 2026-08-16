import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  GitBranchState,
  JiraIssue,
  ParentCandidate,
  WorkStartOutcome,
  WorkStartRequest,
  executeWorkStart$,
  fetchJiraParentCandidates$,
  gitFlowConfigFor,
  normalizeGitLabHost,
  parseGitLabRemoteUrl,
  planWorkStart,
  projectKeyFor,
  rankParentCandidates,
  readGitLabCredentials$,
  readGitBranchState$,
  readJiraCredentials$,
} from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  map,
  of,
  startWith,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { injectGitCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

const IDLE = { kind: 'idle' } as const;

/** What the form holds. Every field is the user's; nothing here is inferred after it is first filled. */
export type WorkStartForm = {
  repoPath: string;
  projectKey: string;
  /** The branch type segment of a main feature. A Task under a Story takes its parent's path instead. */
  type: string;
  summary: string;
  description: string;
  /** The Story this rolls up to, or nothing to start a Story of its own. */
  parentKey: string | null;
};

type ReadStatus =
  | typeof IDLE
  | { kind: 'reading' }
  | { kind: 'ready'; state: GitBranchState; project: string | null }
  | { kind: 'failed'; message: string };

type CandidateStatus =
  typeof IDLE | { kind: 'loading' } | { kind: 'ready'; issues: JiraIssue[] } | { kind: 'failed'; message: string };

type RunStatus = typeof IDLE | { kind: 'running' } | { kind: 'done'; outcome: WorkStartOutcome };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const NO_JIRA = 'Jira needs a host, an account email and a token in Settings.';

const emptyForm = (): WorkStartForm => ({
  repoPath: '',
  projectKey: '',
  type: 'feat',
  summary: '',
  description: '',
  parentKey: null,
});

/**
 * Starts a piece of work: the issue, the branch the grammar names for it, and the draft merge request
 * it will be reviewed in.
 *
 * Nothing is decided here. The plan is `planWorkStart` over the form and the repository as it reads
 * right now, so it re-derives on every keystroke and the user watches the branch name appear as they
 * type the summary. The run takes the same request the plan was built from, which is why what was
 * shown and what happens cannot come apart.
 */
const WORK_START_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const destroyRef = inject(DestroyRef);
  const settings = injectTimetrackSettings();
  const git = injectGitCollector();

  const form = signal<WorkStartForm>(emptyForm());
  const readStatus = signal<ReadStatus>(IDLE);
  const runStatus = signal<RunStatus>(IDLE);
  const reads$ = new Subject<string>();
  const searches$ = new Subject<string>();
  const runs$ = new Subject<void>();

  /**
   * The GitLab project behind the repository's remote, when that remote is the configured instance. A
   * repository nobody reviews in GitLab yields none rather than failing — it still gets a branch.
   */
  const projectFor = (remoteUrl: string | undefined) => {
    const project = remoteUrl ? parseGitLabRemoteUrl(remoteUrl) : null;
    const configured = settings.settings().gitlab.host;

    if (!project || !configured || normalizeGitLabHost(configured) !== normalizeGitLabHost(project.host)) return null;

    return project.path;
  };

  reads$
    .pipe(
      switchMap((repoPath) =>
        repoPath
          ? readGitBranchState$({ processes: ports.processes, repoPath }).pipe(
              map((state): ReadStatus => ({ kind: 'ready', state, project: projectFor(state.remote?.url) })),
              catchError((error: unknown) => of<ReadStatus>({ kind: 'failed', message: messageOf(error) })),
              startWith<ReadStatus>({ kind: 'reading' }),
            )
          : of<ReadStatus>(IDLE),
      ),
      tap((status) => readStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const candidates$ = (projectKey: string): Observable<CandidateStatus> => {
    const ticket = settings.settings().ticket;

    return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials
          ? fetchJiraParentCandidates$({
              transport: ports.transport,
              credentials,
              projectKey,
              issueTypeNames: ticket.parentIssueTypeNames,
              subjectField: ticket.subjectField || undefined,
            })
          : throwError(() => new Error(NO_JIRA)),
      ),
      map((issues): CandidateStatus => ({ kind: 'ready', issues })),
      catchError((error: unknown) => of<CandidateStatus>({ kind: 'failed', message: messageOf(error) })),
    );
  };

  // Debounced on the typed project key: the parents are a search, and one call per keystroke would
  // ask Jira for `F`, `FI` and `FIP`. A `blur` binding is not an option — blur does not bubble out of
  // `et-input`, so the handler would never run.
  const candidateStatus = toSignal(
    searches$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((projectKey) =>
        projectKey
          ? candidates$(projectKey).pipe(startWith<CandidateStatus>({ kind: 'loading' }))
          : of<CandidateStatus>(IDLE),
      ),
    ),
    { initialValue: IDLE as CandidateStatus },
  );

  /** Everything the plan is a function of, or nothing while the repository has not been read. */
  const request = computed((): WorkStartRequest | null => {
    const read = readStatus();
    const draft = form();

    if (read.kind !== 'ready') return null;

    const project = read.project;

    return {
      spec: {
        projectKey: draft.projectKey,
        issueTypeName: settings.settings().ticket.issueTypeName,
        summary: draft.summary,
        description: draft.description,
        type: draft.type,
        ...(draft.parentKey ? { parentKey: draft.parentKey } : {}),
      },
      config: gitFlowConfigFor(settings.settings()),
      state: read.state,
      ...(project ? { gitlabProject: project } : {}),
    };
  });

  // `exhaustMap`: the run files a Jira issue and pushes a branch, so a second press while the first is
  // in flight must not file a second ticket for the same work.
  runs$
    .pipe(
      exhaustMap(() => {
        const pending = request();

        if (!pending) return of<RunStatus>(IDLE);

        const ticket = settings.settings().ticket;

        return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
          switchMap((jira) =>
            readGitLabCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
              switchMap((gitlab) =>
                executeWorkStart$({
                  request: pending,
                  context: {
                    repoPath: form().repoPath,
                    processes: ports.processes,
                    transport: ports.transport,
                    jira,
                    gitlab,
                    ...(ticket.parenting ? { parenting: ticket.parenting } : {}),
                    ...(ticket.parentLinkType ? { parentLinkType: ticket.parentLinkType } : {}),
                    ...(ticket.subjectField ? { subjectField: ticket.subjectField } : {}),
                  },
                }),
              ),
            ),
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

  const update = (change: Partial<WorkStartForm>) => form.set({ ...form(), ...change });

  return {
    form: form.asReadonly(),
    /** Every repository the collector found, which is what the picker offers. */
    repos: computed(() => git.discovery()?.repos ?? []),
    /** The branch types the grammar accepts, for a Story starting its own feature branch. */
    types: computed(() => gitFlowConfigFor(settings.settings()).types),
    isReading: computed(() => readStatus().kind === 'reading'),
    readFailure: computed(() => {
      const status = readStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    candidates: computed((): ParentCandidate[] => {
      const status = candidateStatus();

      return status.kind === 'ready' ? rankParentCandidates({ summary: form().summary, issues: status.issues }) : [];
    }),
    isSearching: computed(() => candidateStatus().kind === 'loading'),
    searchFailure: computed(() => {
      const status = candidateStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    plan: computed(() => {
      const pending = request();

      return pending ? planWorkStart(pending) : null;
    }),
    isRunning: computed(() => runStatus().kind === 'running'),
    outcome: computed(() => {
      const status = runStatus();

      return status.kind === 'done' ? status.outcome : null;
    }),

    setRepoPath: (repoPath: string) => {
      // A link is the user's own statement about this checkout, so picking the repository answers the
      // project field too. Without one the field keeps whatever was typed for the previous choice.
      const linked = projectKeyFor({ context: { repoPath }, links: settings.settings().projectLinks });

      update(linked ? { repoPath, projectKey: linked } : { repoPath });
      runStatus.set(IDLE);
      reads$.next(repoPath);

      if (linked) searches$.next(linked);
    },
    setProjectKey: (projectKey: string) => {
      const trimmed = projectKey.trim().toUpperCase();

      update({ projectKey: trimmed });
      searches$.next(trimmed);
    },
    setType: (type: string) => update({ type }),
    setSummary: (summary: string) => update({ summary }),
    setDescription: (description: string) => update({ description }),
    setParentKey: (parentKey: string | null) => update({ parentKey }),

    run: () => runs$.next(),

    reset: () => {
      const { repoPath, projectKey, type } = form();

      form.set({ ...emptyForm(), repoPath, projectKey, type });
      runStatus.set(IDLE);
      reads$.next(repoPath);
    },
  };
});

export const injectWorkStart = /* @__PURE__ */ toInjectFn(WORK_START_DEF);
