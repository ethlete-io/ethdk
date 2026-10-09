import {
  DEFAULT_PATTERN_WEEKS,
  JiraCreatableType,
  JiraCredentials,
  JiraIssue,
  JiraIssueType,
  TicketCandidate,
  TimetrackPorts,
  TimetrackSettings,
  childTypeNameFor,
  dayBoundaryOf,
  describeJiraHierarchy$,
  fetchJiraCreatableTypes$,
  fetchJiraLoggedIssues$,
  fetchJiraOpenIssues$,
  fetchJiraParentCandidates$,
  localDayKey,
  readJiraCredentials$,
  shiftDayKey,
  ticketMatchCandidates,
  userNamedIssueKeys,
} from '@ethlete/timetrack';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

export const NO_JIRA = 'Jira needs a host, an account email and a token in Settings.';

/** The project's issues: the open ones a ticket may roll up to, and every one it could already be. */
export type ProjectIssues = {
  projectKey: string;
  parents: JiraIssue[];
  open: TicketCandidate[];
  /** The issues the user logged or named rows with that `open` lacks, done ones included. */
  logged: JiraIssue[];
  /** What this account may create here. Empty until the read lands, which offers no type at all. */
  creatable: JiraCreatableType[];
  /** The types a parent may be: the ones settings name that something can be filed under. */
  parentTypes: string[];
  /** The instance's own levels, which decide what type the ticket under a picked parent must be. */
  issueTypes: JiraIssueType[];
};

/**
 * The types an issue may be offered as a parent under: the ones settings name, minus any the
 * account can file nothing beneath. Jira's parent field points one level down, so a parent with no
 * creatable type below it is a choice that fails after the user wrote a summary.
 *
 * Nothing is dropped where `parenting` is `issue-link`. That link expresses a same-level relation,
 * which is the whole purpose of the setting.
 */
const parentTypesFor = (options: {
  settings: TimetrackSettings;
  types: readonly JiraIssueType[];
  creatable: readonly JiraCreatableType[];
}) => {
  const { ticket } = options.settings;

  if (ticket.parenting === 'issue-link') return [...ticket.parentIssueTypeNames];

  return ticket.parentIssueTypeNames.filter(
    (parentTypeName) =>
      childTypeNameFor({
        parentTypeName,
        preferredTypeNames: [ticket.issueTypeName],
        types: options.types,
        creatable: options.creatable,
      }) !== null,
  );
};

// The hierarchy has to land before the parent read: it decides which types that read asks for.
// Two reads rather than one filtered afterwards: the parent list is the most recent 30 of the
// parent types, and narrowing a window of open issues to those types would offer fewer parents the
// busier the project is.
export const readProjectIssues$ = (options: {
  ports: Pick<TimetrackPorts, 'secrets' | 'transport'>;
  settings: TimetrackSettings;
  projectKey: string;
  /** The keys the user logged on or named rows with, most relevant first. Any project's. */
  loggedKeys?: readonly string[];
  open$?: (credentials: JiraCredentials) => Observable<TicketCandidate[]>;
}): Observable<ProjectIssues> => {
  const { ports, settings, projectKey } = options;
  const subjectField = settings.ticket.subjectField || undefined;

  return readJiraCredentials$({ secrets: ports.secrets, settings }).pipe(
    switchMap((credentials) =>
      credentials
        ? describeJiraHierarchy$({ transport: ports.transport, credentials }).pipe(
            switchMap((hierarchy) =>
              fetchJiraCreatableTypes$({ transport: ports.transport, credentials, projectKey }).pipe(
                switchMap((creatable) => {
                  const parentTypes = parentTypesFor({ settings, types: hierarchy.issueTypes, creatable });

                  return forkJoin({
                    // An empty `issueTypeNames` reads as "any type", so a project with no usable
                    // parent level must skip the read rather than make it.
                    parents: parentTypes.length
                      ? fetchJiraParentCandidates$({
                          transport: ports.transport,
                          credentials,
                          projectKey,
                          issueTypeNames: parentTypes,
                          subjectField,
                        })
                      : of<JiraIssue[]>([]),
                    open:
                      options.open$?.(credentials) ??
                      fetchJiraOpenIssues$({ transport: ports.transport, credentials, projectKey, subjectField }),
                    logged: fetchJiraLoggedIssues$({
                      transport: ports.transport,
                      credentials,
                      projectKey,
                      loggedKeys: options.loggedKeys ?? [],
                      subjectField,
                    }).pipe(catchError(() => of<JiraIssue[]>([]))),
                  }).pipe(
                    map(({ parents, open, logged }) => ({
                      projectKey,
                      parents,
                      open,
                      logged: logged.filter((issue) => !open.some((held) => held.key === issue.key)),
                      creatable,
                      parentTypes,
                      issueTypes: hierarchy.issueTypes,
                    })),
                  );
                }),
              ),
            ),
          )
        : throwError(() => new Error(NO_JIRA)),
    ),
  );
};

/** Every issue the work could already be: the project's open ones, then the logged ones. */
export const matchCandidatesOf = (issues: Pick<ProjectIssues, 'open' | 'logged'>) => ticketMatchCandidates(issues);

/**
 * The keys the work could already be, from the user's own record: the keys the user named rows of
 * `standInDays` with, then `tempoKeys`, then the keys the user named rows of the last
 * `DEFAULT_PATTERN_WEEKS` with. Each key once. A store that will not answer leaves `tempoKeys`.
 */
export const readLoggedKeys$ = (options: {
  ports: Pick<TimetrackPorts, 'review'>;
  settings: TimetrackSettings;
  tempoKeys: readonly string[];
  standInDays?: readonly string[];
}): Observable<string[]> => {
  const standInDays = new Set(options.standInDays ?? []);
  const today = localDayKey(new Date(), dayBoundaryOf(options.settings));
  const from = [shiftDayKey(today, -DEFAULT_PATTERN_WEEKS * 7), ...standInDays].sort()[0] ?? today;

  return options.ports.review.editsBetween$(from, today).pipe(
    map((days) => [
      ...new Set([
        ...userNamedIssueKeys(days.filter(({ day }) => standInDays.has(day))),
        ...options.tempoKeys.map((key) => key.trim().toUpperCase()),
        ...userNamedIssueKeys(days),
      ]),
    ]),
    catchError(() => of([...options.tempoKeys])),
  );
};
