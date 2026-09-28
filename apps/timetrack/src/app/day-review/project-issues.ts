import {
  JiraCreatableType,
  JiraIssue,
  JiraIssueType,
  TimetrackPorts,
  TimetrackSettings,
  childTypeNameFor,
  describeJiraHierarchy$,
  fetchJiraCreatableTypes$,
  fetchJiraOpenIssues$,
  fetchJiraParentCandidates$,
  readJiraCredentials$,
} from '@ethlete/timetrack';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';

export const NO_JIRA = 'Jira needs a host, an account email and a token in Settings.';

/** The project's open issues: the ones a ticket may roll up to, and every one it could already be. */
export type ProjectIssues = {
  parents: JiraIssue[];
  open: JiraIssue[];
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
                    open: fetchJiraOpenIssues$({ transport: ports.transport, credentials, projectKey, subjectField }),
                  }).pipe(map((issues) => ({ ...issues, creatable, parentTypes, issueTypes: hierarchy.issueTypes })));
                }),
              ),
            ),
          )
        : throwError(() => new Error(NO_JIRA)),
    ),
  );
};
