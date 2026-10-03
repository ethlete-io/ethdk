import { Observable, catchError, defer, finalize, map, of, shareReplay, switchMap } from 'rxjs';
import { alreadyFiled } from '../ticket/parents';
import { TimetrackTransport } from '../transport/ports';
import { adfDocument } from './adf';
import { fetchJiraDuplicateCandidates$ } from './candidates';
import { JiraCredentials, jiraRequest$ } from './client';
import { JiraParenting } from './hierarchy';

/**
 * A new issue, as the app files it. The project and the issue type are names rather than ids because
 * that is what a user can read back in the settings screen and recognise in Jira.
 */
export type JiraIssueInput = {
  projectKey: string;
  issueTypeName: string;
  summary: string;
  description: string;
  /** The Story or Epic this issue rolls up to, when the user picked one. */
  parentKey?: string;
  /** How this instance expresses the relation to `parentKey`. */
  parenting?: JiraParenting;
  /** The link type used when `parenting` is `issue-link`, such as `Relates`. */
  parentLinkType?: string;
  /** The instance's branch-subject field id, such as `customfield_10057`. Empty writes none. */
  subjectField?: string;
  /** The account the issue is assigned to. Absent files it unassigned, as Jira's own default does. */
  assigneeAccountId?: string;
  /** The branch subject the grammar would use, such as `user-management`. */
  subject?: string;
};

export type JiraCreatedIssue = {
  id: string;
  key: string;
  /** Why the link to `parentKey` failed. The issue exists regardless, so a retry must not file it again. */
  linkError?: string;
  /** True where Jira already held this issue, or another call was filing it, so nothing new was filed. */
  duplicate?: true;
};

type JiraCreatedIssueResource = {
  id?: string;
  key?: string;
};

const fieldsFor = (input: JiraIssueInput) => ({
  project: { key: input.projectKey },
  issuetype: { name: input.issueTypeName },
  summary: input.summary,
  description: adfDocument(input.description),
  ...(input.parentKey && input.parenting !== 'issue-link' ? { parent: { key: input.parentKey } } : {}),
  ...(input.subjectField && input.subject ? { [input.subjectField]: input.subject } : {}),
  ...(input.assigneeAccountId ? { assignee: { accountId: input.assigneeAccountId } } : {}),
});

/**
 * Links a new issue to its parent on an instance whose hierarchy cannot express the relation through
 * the parent field. Jira's default hierarchy puts Story and Task on the same level, where a link is
 * the only thing that says the two belong together.
 */
export const linkJiraIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  inwardKey: string;
  outwardKey: string;
  linkType: string;
}): Observable<void> =>
  jiraRequest$<unknown>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/rest/api/3/issueLink',
    describe: `a link from ${options.inwardKey} to ${options.outwardKey}`,
    method: 'POST',
    body: {
      type: { name: options.linkType },
      inwardIssue: { key: options.inwardKey },
      outwardIssue: { key: options.outwardKey },
    },
  }).pipe(map(() => undefined));

const postJiraIssue$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  input: JiraIssueInput;
}): Observable<JiraCreatedIssue> => {
  const { transport, credentials, input } = options;

  return jiraRequest$<JiraCreatedIssueResource>({
    transport,
    credentials,
    path: '/rest/api/3/issue',
    describe: `a new ${input.issueTypeName} in ${input.projectKey}`,
    method: 'POST',
    body: { fields: fieldsFor(input) },
  }).pipe(
    map((resource) => {
      if (!resource.key || !resource.id) {
        throw new Error(`Jira accepted the issue in ${input.projectKey} but returned no key.`);
      }

      return { id: resource.id, key: resource.key };
    }),
    switchMap((created) =>
      input.parentKey && input.parenting === 'issue-link'
        ? linkJiraIssues$({
            transport,
            credentials,
            inwardKey: created.key,
            outwardKey: input.parentKey,
            linkType: input.parentLinkType ?? 'Relates',
          }).pipe(
            map(() => created),
            catchError((error: unknown) =>
              of({ ...created, linkError: error instanceof Error ? error.message : String(error) }),
            ),
          )
        : of(created),
    ),
  );
};

const inFlight = new Map<string, Observable<JiraCreatedIssue>>();

const lockKeyOf = (credentials: JiraCredentials, input: JiraIssueInput) =>
  [credentials.host, credentials.email, input.projectKey, input.summary.trim().replace(/\s+/g, ' ').toLowerCase()].join(
    '\n',
  );

/**
 * Files one issue and reads back its key. An issue the project already holds with this summary, or one
 * another call is filing right now, is answered with `duplicate: true` instead of being filed again.
 */
export const createJiraIssue$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  input: JiraIssueInput;
}): Observable<JiraCreatedIssue> =>
  defer(() => {
    const { transport, credentials, input } = options;
    const lockKey = lockKeyOf(credentials, input);
    const running = inFlight.get(lockKey);

    if (running) return running.pipe(map((created): JiraCreatedIssue => ({ ...created, duplicate: true })));

    const guarded$ = fetchJiraDuplicateCandidates$({
      transport,
      credentials,
      projectKey: input.projectKey,
      subjectField: input.subjectField,
    }).pipe(
      switchMap((issues) => {
        const held = alreadyFiled({ summary: input.summary, issues });

        return held
          ? of<JiraCreatedIssue>({ id: held.id, key: held.key, duplicate: true })
          : postJiraIssue$({ transport, credentials, input });
      }),
      finalize(() => {
        if (inFlight.get(lockKey) === guarded$) inFlight.delete(lockKey);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    inFlight.set(lockKey, guarded$);

    return guarded$;
  });
