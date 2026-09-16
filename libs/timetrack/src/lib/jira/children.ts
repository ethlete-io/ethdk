import { Observable, forkJoin, map, of } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { searchJiraIssues$ } from './search';

/** How many children of one parent the epic rung reads. Settable as `epicChildLimit`. */
export const DEFAULT_EPIC_CHILD_LIMIT = 100;

/** The smallest cap that can still say anything: a parent has to hold the sibling and one other child. */
export const MIN_EPIC_CHILD_LIMIT = 2;

export type JiraIssueChildren = {
  parentKey: string;
  childKeys: string[];
  /** The cap cut the list short. The rung then names nothing rather than eliminate over half a list. */
  truncated: boolean;
};

/** A key reaches JQL as a literal, and it comes from an issue the user's own work named. */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The open children of each parent, one read per parent.
 *
 * Only open ones: an epic collects work over months, and a finished task left in the list makes the
 * rung's elimination fail on every long-lived epic. One read per parent rather than one `parent in
 * (…)` read, because the cap has to be reported per parent and a shared page cannot say which parent
 * it cut short.
 */
export const fetchJiraIssueChildren$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  parentKeys: readonly string[];
  limit?: number;
}): Observable<JiraIssueChildren[]> => {
  const keys = [...new Set(options.parentKeys.filter((key) => !!key.trim()))];

  if (!keys.length) return of([]);

  const limit = Math.max(MIN_EPIC_CHILD_LIMIT, Math.round(options.limit ?? DEFAULT_EPIC_CHILD_LIMIT));

  return forkJoin(
    keys.map((parentKey) =>
      searchJiraIssues$({
        transport: options.transport,
        credentials: options.credentials,
        jql: `parent = ${quoted(parentKey)} AND statusCategory != Done ORDER BY created ASC`,
        fields: ['summary'],
        describe: `open children of ${parentKey}`,
        // One over the cap, so a list that filled it exactly can still be told from one that was cut.
        options: { pageSize: limit + 1, maxPages: 1 },
      }).pipe(
        map((resources): JiraIssueChildren => {
          const childKeys = resources.map((resource) => resource.key).filter((key): key is string => !!key);

          return { parentKey, childKeys: childKeys.slice(0, limit), truncated: childKeys.length > limit };
        }),
      ),
    ),
  );
};
