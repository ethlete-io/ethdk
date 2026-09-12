import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import {
  Observable,
  Subject,
  catchError,
  debounce,
  exhaustMap,
  groupBy,
  map,
  mergeMap,
  of,
  scan,
  startWith,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

const IDLE = { kind: 'idle' } as const;

type Loaded<T> = typeof IDLE | { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'failed'; message: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const NO_JIRA = 'Jira needs a host, an account email and a token in Settings.';

const valueOf = <T>(status: Loaded<T>, fallback: T) => (status.kind === 'ready' ? status.value : fallback);

const failureOf = <T>(status: Loaded<T>) => (status.kind === 'failed' ? status.message : null);

/** How long typing rests before it reaches Jira. Every keystroke is otherwise a call of its own. */
const TEXT_REST_MS = 300;

/** What one picker asks for: the project it is narrowed to, and the text typed into it. */
export type JiraIssueAsk = {
  /** A project key, or empty for the projects the user picked. */
  scope: string;
  text: string;
};

/** One scope's list, with what it was read for — so an ask nothing changed is not read twice. */
type IssueList = {
  projectKeys: readonly string[];
  text: string;
  issues: JiraIssue[];
  isLoading: boolean;
  failure: string | null;
};

const NO_LIST: IssueList = { projectKeys: [], text: '', issues: [], isLoading: false, failure: null };

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/** A read in flight keeps the list it replaces, so typing narrows a list instead of blanking it. */
const issuesIn = (previous: IssueList | undefined, status: Loaded<JiraIssue[]>) => {
  if (status.kind === 'ready') return status.value;

  return status.kind === 'loading' ? (previous?.issues ?? []) : [];
};

/**
 * What Jira can tell the window about itself: the instance's projects, its issue types, and the issues
 * a picker offers.
 *
 * One reader for the whole app, because each of these answers the same question on several screens and
 * a list read per component is a call per component. Nothing is read until something asks: these are
 * calls against a rate-limited API, and a screen that fires three of them on mount is a screen that
 * cannot be opened offline.
 *
 * The issues are one list per scope, kept keyed by it, so the pickers of one project share a read and
 * a picker narrowed to another project does not read the whole pick to throw most of it away. Typed
 * text reaches Jira rather than filtering the hundred issues already in hand: the ticket somebody
 * searches for is regularly the one the first page did not hold.
 */
const JIRA_CATALOG_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();

  const projectLoads$ = new Subject<void>();
  const issueTypeLoads$ = new Subject<void>();
  const fieldLoads$ = new Subject<void>();
  const issueAsks$ = new Subject<JiraIssueAsk>();

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

  /** The projects one scope reads. An empty scope reads the projects the user picked, in their order. */
  const keysFor = (scope: string) => (scope ? [scope] : favoriteProjectKeys(settings.settings()));

  const issueLists = toSignal(
    issueAsks$.pipe(
      // One group per scope, because a picker narrowed to one project and one reading the whole pick
      // are two questions. `switchMap` inside the group only: an ask cancels the read it replaces,
      // and never the read another scope is waiting for.
      groupBy((ask) => ask.scope),
      mergeMap((asks$) =>
        asks$.pipe(
          // An opened picker must not wait out a window nobody typed in, so only text rests.
          debounce((ask) => (ask.text ? timer(TEXT_REST_MS) : of(0))),
          switchMap((ask) => {
            const projectKeys = keysFor(ask.scope);

            return loaded$(
              withCredentials$((credentials) =>
                fetchJiraIssuePicks$({
                  transport: ports.transport,
                  credentials,
                  filter: { projectKeys, text: ask.text },
                }),
              ),
            ).pipe(map((status) => ({ scope: ask.scope, text: ask.text, projectKeys, status })));
          }),
        ),
      ),
      scan((all: Record<string, IssueList>, read) => {
        const previous = all[read.scope];

        return {
          ...all,
          [read.scope]: {
            projectKeys: read.projectKeys,
            text: read.text,
            issues: issuesIn(previous, read.status),
            isLoading: read.status.kind === 'loading',
            failure: failureOf(read.status),
          },
        };
      }, {}),
    ),
    { initialValue: {} as Record<string, IssueList> },
  );

  /**
   * The list one scope holds, or none at all.
   *
   * A list read for other projects than the ones picked now is no answer: the user changed the pick in
   * Settings, and a stale list is worse than an empty one. The next ask reads it again.
   */
  const listFor = (scope: string) => {
    const list = issueLists()[scope];

    return list && sameKeys(list.projectKeys, keysFor(scope)) ? list : NO_LIST;
  };

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

    /** The issues one scope offers, most recently touched first. Empty until something asks for them. */
    issuesFor: (scope: string) => listFor(scope).issues,
    isLoadingIssuesFor: (scope: string) => listFor(scope).isLoading,
    issueFailureFor: (scope: string) => listFor(scope).failure,
    /**
     * Asks Jira for one picker's list. Typing rests before the call, and an ask a read already answers
     * costs nothing — so every picker of one scope may ask on every open and on every keystroke.
     */
    askForIssues: (ask: JiraIssueAsk) => {
      const list = issueLists()[ask.scope];

      if (list && list.text === ask.text && sameKeys(list.projectKeys, keysFor(ask.scope))) return;

      issueAsks$.next(ask);
    },
    /** Reads one scope again, with the text it last read — after a failure, or a token fixed since. */
    reloadIssues: (scope: string) => issueAsks$.next({ scope, text: issueLists()[scope]?.text ?? '' }),
  };
});

export const injectJiraCatalog = /* @__PURE__ */ toInjectFn(JIRA_CATALOG_DEF);
