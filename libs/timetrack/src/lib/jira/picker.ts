import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { projectKeyOf } from '../ticket/project';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssue, fetchJiraIssues$, toJiraIssue } from './issue';
import { JiraProject, fetchJiraProjects$ } from './projects';
import { searchJiraIssues$ } from './search';

/** How many issues a picker reads. A list longer than this is one nobody scrolls to the end of. */
export const DEFAULT_JIRA_PICKER_LIMIT = 100;

/**
 * How many pages of projects a typed number is read against, most recently worked in first. Two pages
 * of fifty is every project anybody still books against, and one more call on a rare kind of search.
 */
const NUMBER_PROJECT_PAGES = 2;

/** What narrows the issues a picker offers. Everything is optional, and each part narrows further. */
export type JiraIssuePickerFilter = {
  /** The projects to read. Empty reads every project the token can see, which is rarely what a user wants. */
  projectKeys?: readonly string[];
  /** Free text, matched against the issues' own wording. Text that is an issue key reads that key. */
  text?: string;
  /** Only the issues the token's own account is assigned. */
  assignedToMe?: boolean;
  /** Whether to include issues that are already done. Off, because today's work is rarely one of them. */
  includeDone?: boolean;
  limit?: number;
};

/** A project key, a type name and typed text all reach JQL as literals, and all three are user input. */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The clauses the filter states, in the order JQL reads them. A filter that states nothing yields the
 * open issues of every project the token can see, ordered by recency.
 */
const jqlFor = (filter: JiraIssuePickerFilter) => {
  const projectKeys = (filter.projectKeys ?? []).map((key) => key.trim()).filter(Boolean);
  const text = filter.text?.trim();

  return [
    ...(projectKeys.length ? [`project in (${projectKeys.map(quoted).join(', ')})`] : []),
    ...(filter.includeDone ? [] : ['statusCategory != Done']),
    ...(filter.assignedToMe ? ['assignee = currentUser()'] : []),
    ...(text ? [`text ~ ${quoted(`${text}*`)}`] : []),
  ].join(' AND ');
};

/**
 * A typed issue key. Jira's `text ~` reads the wording and never the key, so `ET-772` typed into a
 * picker matches nothing at all unless the key is read on its own.
 */
const typedKeyIn = (text: string | undefined) => {
  const key = text?.trim().toUpperCase() ?? '';

  return projectKeyOf(key) ? key : null;
};

/**
 * A typed number, which is an issue key with the project left off — `2049` for `BD-2049`. People say
 * and paste a key that way, and `text ~` reads a key's number as little as it reads the key itself.
 */
const typedNumberIn = (text: string | undefined) => {
  const number = text?.trim() ?? '';

  return /^\d+$/.test(number) ? number : null;
};

const uniqueKeys = (keys: readonly string[]) => [
  ...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean)),
];

/** The issues answer in the order their keys were asked for, so the picker's own projects read first. */
const inAskedOrder = (issues: JiraIssue[], keys: string[]) => {
  const rank = new Map(keys.map((key, index) => [key, index]));

  return [...issues].sort((a, b) => (rank.get(a.key) ?? keys.length) - (rank.get(b.key) ?? keys.length));
};

/**
 * The issues one typed number could name, read as a key against the picker's projects first and the
 * instance's active ones after. A key Jira does not know costs nothing: the search endpoint answers
 * an unknown key with no issue rather than with an error.
 */
const numberedIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  number: string;
  projectKeys: readonly string[];
  subjectField?: string;
}) =>
  fetchJiraProjects$({
    transport: options.transport,
    credentials: options.credentials,
    maxPages: NUMBER_PROJECT_PAGES,
  }).pipe(
    catchError(() => of<JiraProject[]>([])),
    map((projects) =>
      uniqueKeys([...options.projectKeys, ...projects.map((project) => project.key)]).map(
        (projectKey) => `${projectKey}-${options.number}`,
      ),
    ),
    switchMap((keys) =>
      fetchJiraIssues$({
        transport: options.transport,
        credentials: options.credentials,
        keys,
        subjectField: options.subjectField,
      }).pipe(map((issues) => inAskedOrder(issues, keys))),
    ),
  );

/** The keyed issues first, then whatever the wording search found that they do not already hold. */
const withoutRepeats = (keyed: JiraIssue[], found: JiraIssue[]) => {
  const seen = new Set(keyed.map((issue) => issue.key));

  return [...keyed, ...found.filter((issue) => !seen.has(issue.key))];
};

/**
 * The issues a picker offers, most recently worked in first.
 *
 * One read for every issue field a picker shows, narrowed by whatever the user asked for. The recency
 * ordering is what makes the first page useful without any typing at all: the issue today's work
 * belongs to is nearly always one the account touched this week.
 *
 * Text that reads as an issue key is answered by that one key instead of by a search, and the key is
 * read outside every other clause: the escape hatch exists for the ticket no list holds, which is
 * regularly one that is closed, or one of a project nobody picked.
 *
 * Text that is only a number is read as a key too, against every project rather than one, and the
 * wording search still runs beside it — `2049` names `BD-2049` to the person typing it, and `2026`
 * names a year to the person typing that.
 */
export const fetchJiraIssuePicks$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  filter?: JiraIssuePickerFilter;
  subjectField?: string;
}): Observable<JiraIssue[]> => {
  const filter = options.filter ?? {};
  const typedKey = typedKeyIn(filter.text);

  if (typedKey) {
    return fetchJiraIssues$({
      transport: options.transport,
      credentials: options.credentials,
      keys: [typedKey],
      subjectField: options.subjectField,
    });
  }

  const jql = jqlFor(filter);
  const found$ = searchJiraIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `${jql ? `${jql} ` : ''}ORDER BY updated DESC`,
    fields: ['summary', 'issuetype', 'parent', ...(options.subjectField ? [options.subjectField] : [])],
    describe: 'issues to pick from',
    options: { pageSize: filter.limit ?? DEFAULT_JIRA_PICKER_LIMIT, maxPages: 1 },
  }).pipe(map((resources) => resources.flatMap((resource) => toJiraIssue(resource, options.subjectField) ?? [])));

  const typedNumber = typedNumberIn(filter.text);

  if (!typedNumber) return found$;

  return forkJoin([
    numberedIssues$({
      transport: options.transport,
      credentials: options.credentials,
      number: typedNumber,
      projectKeys: filter.projectKeys ?? [],
      subjectField: options.subjectField,
    }),
    found$,
  ]).pipe(map(([keyed, found]) => withoutRepeats(keyed, found)));
};
