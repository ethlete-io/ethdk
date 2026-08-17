import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  JiraCredentials,
  JiraField,
  JiraIssue,
  JiraIssueType,
  JiraProject,
  favoriteProjectKeys,
  fetchJiraFields$,
  fetchJiraIssuePicks$,
  fetchJiraIssueTypes$,
  fetchJiraProjects$,
  jiraSubjectFieldCandidates,
  readJiraCredentials$,
} from '@ethlete/timetrack';
import { Observable, Subject, catchError, exhaustMap, map, of, startWith, switchMap, throwError } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { readViewState, rememberViewState } from '../view-state';

const IDLE = { kind: 'idle' } as const;

type Loaded<T> = typeof IDLE | { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'failed'; message: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const NO_JIRA = 'Jira needs a host, an account email and a token in Settings.';

const valueOf = <T>(status: Loaded<T>, fallback: T) => (status.kind === 'ready' ? status.value : fallback);

const failureOf = <T>(status: Loaded<T>) => (status.kind === 'failed' ? status.message : null);

/**
 * What Jira can tell the window about itself: the instance's projects, its issue types, and the issues
 * a picker offers.
 *
 * One reader for the whole app, because each of these answers the same question on several screens and
 * a list read per component is a call per component. Nothing is read until something asks: these are
 * calls against a rate-limited API, and a screen that fires three of them on mount is a screen that
 * cannot be opened offline.
 *
 * The issues are one list rather than a search per picker. It is the open issues of the projects the
 * user picked, most recently touched first, and every picker filters it as the user types — which is
 * instant, shares one call, and cannot fire a request per keystroke. An issue outside the list is still
 * reachable, because a picker also takes a typed key.
 */
const JIRA_CATALOG_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();

  const projectLoads$ = new Subject<void>();
  const issueTypeLoads$ = new Subject<void>();
  const fieldLoads$ = new Subject<void>();
  /** Counts asks for the issue list, so re-reading the same scope is still a new read. */
  const issueRevision = signal(0);
  const assignedToMe = signal(readViewState().assignedToMe ?? false);

  /** Runs a read with the configured credentials, or fails with the one message that names the cause. */
  const withCredentials$ = <T>(read$: (credentials: JiraCredentials) => Observable<T>) =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) => (credentials ? read$(credentials) : throwError(() => new Error(NO_JIRA)))),
    );

  const loaded$ = <T>(read$: Observable<T>): Observable<Loaded<T>> =>
    read$.pipe(
      map((value): Loaded<T> => ({ kind: 'ready', value })),
      catchError((error: unknown) => of<Loaded<T>>({ kind: 'failed', message: messageOf(error) })),
      startWith<Loaded<T>>({ kind: 'loading' }),
    );

  // `exhaustMap`: a second ask while the first read is in flight would answer the same question twice.
  const projectStatus = toSignal(
    projectLoads$.pipe(
      exhaustMap(() =>
        loaded$(withCredentials$((credentials) => fetchJiraProjects$({ transport: ports.transport, credentials }))),
      ),
    ),
    { initialValue: IDLE as Loaded<JiraProject[]> },
  );

  const issueTypeStatus = toSignal(
    issueTypeLoads$.pipe(
      exhaustMap(() =>
        loaded$(withCredentials$((credentials) => fetchJiraIssueTypes$({ transport: ports.transport, credentials }))),
      ),
    ),
    { initialValue: IDLE as Loaded<JiraIssueType[]> },
  );

  const fieldStatus = toSignal(
    fieldLoads$.pipe(
      exhaustMap(() =>
        loaded$(withCredentials$((credentials) => fetchJiraFields$({ transport: ports.transport, credentials }))),
      ),
    ),
    { initialValue: IDLE as Loaded<JiraField[]> },
  );

  /**
   * The scope the issue list is read for, or `null` until something asks for it. Picking a project or
   * narrowing to your own issues re-reads on its own: the list in every open picker is then for a scope
   * nobody chose, and a stale list is worse than a spinner.
   */
  const issueScope = computed(() =>
    issueRevision() === 0
      ? null
      : {
          projectKeys: favoriteProjectKeys(settings.settings()),
          assignedToMe: assignedToMe(),
          revision: issueRevision(),
        },
  );

  // `switchMap`, not `exhaustMap`: a scope that changed makes the read in flight the answer to a
  // question nobody is asking any more.
  const issueStatus = toSignal(
    toObservable(issueScope).pipe(
      switchMap((filter) =>
        filter
          ? loaded$(
              withCredentials$((credentials) =>
                fetchJiraIssuePicks$({ transport: ports.transport, credentials, filter }),
              ),
            )
          : of<Loaded<JiraIssue[]>>(IDLE),
      ),
    ),
    { initialValue: IDLE as Loaded<JiraIssue[]> },
  );

  const askForIssues = () => issueRevision.update((count) => count + 1);

  return {
    /** Every project the token can file into, most recently worked in first. Read on `loadProjects`. */
    projects: computed(() => valueOf<JiraProject[]>(projectStatus(), [])),
    isLoadingProjects: computed(() => projectStatus().kind === 'loading'),
    projectFailure: computed(() => failureOf(projectStatus())),
    /** Reads the projects once. A caller may ask on every mount; only the first one calls Jira. */
    loadProjects: () => {
      if (projectStatus().kind !== 'ready') projectLoads$.next();
    },
    /** Reads them again — after a failed read, or a token that was fixed since. */
    reloadProjects: () => projectLoads$.next(),

    /** The instance's issue types, so a ticket's level is picked rather than typed from memory. */
    issueTypes: computed(() => valueOf<JiraIssueType[]>(issueTypeStatus(), [])),
    isLoadingIssueTypes: computed(() => issueTypeStatus().kind === 'loading'),
    issueTypeFailure: computed(() => failureOf(issueTypeStatus())),
    loadIssueTypes: () => {
      if (issueTypeStatus().kind !== 'ready') issueTypeLoads$.next();
    },
    reloadIssueTypes: () => issueTypeLoads$.next(),

    /** The custom text fields a branch subject could be written to, by name rather than by field id. */
    subjectFields: computed(() => jiraSubjectFieldCandidates(valueOf<JiraField[]>(fieldStatus(), []))),
    isLoadingFields: computed(() => fieldStatus().kind === 'loading'),
    fieldFailure: computed(() => failureOf(fieldStatus())),
    loadFields: () => {
      if (fieldStatus().kind !== 'ready') fieldLoads$.next();
    },
    reloadFields: () => fieldLoads$.next(),

    /** The open issues of the picked projects, for every picker to filter as it is typed. */
    issues: computed(() => valueOf<JiraIssue[]>(issueStatus(), [])),
    isLoadingIssues: computed(() => issueStatus().kind === 'loading'),
    issueFailure: computed(() => failureOf(issueStatus())),
    /** Whether the list is narrowed to the account's own issues. Remembered across restarts. */
    assignedToMe: assignedToMe.asReadonly(),
    setAssignedToMe: (only: boolean) => {
      assignedToMe.set(only);
      rememberViewState({ assignedToMe: only });
    },
    loadIssues: () => {
      if (issueRevision() === 0) askForIssues();
    },
    reloadIssues: askForIssues,
  };
});

export const injectJiraCatalog = /* @__PURE__ */ toInjectFn(JIRA_CATALOG_DEF);
