import { Observable, map } from 'rxjs';
import { IssueActivity } from '../correlate/attribute';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { searchJiraIssues$ } from './search';

const pad = (value: number) => String(value).padStart(2, '0');

/** JQL date literals are `yyyy/MM/dd HH:mm` in the *instance's* timezone, which is the user's. */
const jqlMoment = (date: Date) =>
  `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * The issues the user themselves changed inside the window, with the moment of the change — the
 * issue-view rung of the attribution ladder. `updatedBy` is the only Jira signal that carries a
 * timestamp; the recently-viewed list (`issueHistory()`) has none, so it cannot place a block.
 */
export const fetchJiraIssueActivity$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  from: Date;
  to: Date;
}): Observable<IssueActivity[]> =>
  searchJiraIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `issuekey in updatedBy(currentUser(), "${jqlMoment(options.from)}", "${jqlMoment(options.to)}") ORDER BY updated ASC`,
    fields: ['summary', 'updated'],
    describe: `issues you changed on ${jqlMoment(options.from)}`,
  }).pipe(
    map((resources) =>
      resources.flatMap((resource): IssueActivity | [] => {
        const updated = resource.fields?.updated;
        const at = updated ? new Date(updated) : undefined;

        if (!resource.key || !at || Number.isNaN(at.getTime())) return [];

        return { kind: 'issue-view', issueKey: resource.key, at, detail: `you changed ${resource.key} in Jira` };
      }),
    ),
  );
