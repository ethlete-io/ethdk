import { Observable, concatMap, from, map, of, reduce } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssueFields, JiraIssueResource, searchJiraIssues$ } from './search';

export type JiraIssue = {
  key: string;
  /** The numeric id. Tempo worklogs reference this, never the key, so every sync resolves it. */
  id: string;
  summary: string;
  issueType: string;
  /** Jira's own flag on the type. A sub-task is a leaf, so no hierarchy accepts it as a parent. */
  isSubtask?: boolean;
  /** The parent issue, when the instance reports one — a Task under its Story. */
  parentKey?: string;
  /** The configured subject field's value, when the instance has one and this issue sets it. */
  subject?: string;
};

/** Jira rejects an over-long JQL string, and a day's keys can be many. */
const KEYS_PER_REQUEST = 50;

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

/**
 * A branch subject has to be a plain string. A rich-text or select field configured as the subject
 * field yields an object, which is a misconfiguration to report rather than something to stringify.
 */
const readSubjectField = (fields: JiraIssueFields, field: string | undefined) => {
  if (!field) return undefined;

  const value = fields[field];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/**
 * Reads one search result into the app's shape, or nothing when Jira returned neither a key nor an
 * id. `subjectField` names the instance's branch-subject field, which every caller reads differently.
 */
export const toJiraIssue = (resource: JiraIssueResource, subjectField?: string): JiraIssue | undefined =>
  resource.key && resource.id
    ? {
        key: resource.key,
        id: resource.id,
        summary: resource.fields?.summary ?? '',
        issueType: resource.fields?.issuetype?.name ?? '',
        isSubtask: resource.fields?.issuetype?.subtask ?? false,
        parentKey: resource.fields?.parent?.key,
        subject: readSubjectField(resource.fields ?? {}, subjectField),
      }
    : undefined;

/**
 * Resolves issue keys to the ids, summaries and parents a day of proposals needs. Keys Jira does not
 * know are simply absent from the result — correlation can produce a key from a typo in a branch
 * name, and one bad key must not fail the whole day.
 */
export const fetchJiraIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  keys: string[];
  subjectField?: string;
}): Observable<JiraIssue[]> => {
  const keys = [...new Set(options.keys.map((key) => key.trim().toUpperCase()).filter(Boolean))];

  if (keys.length === 0) return of([]);

  const fields = ['summary', 'issuetype', 'parent', ...(options.subjectField ? [options.subjectField] : [])];

  return from(chunk(keys, KEYS_PER_REQUEST)).pipe(
    concatMap((batch) =>
      searchJiraIssues$({
        transport: options.transport,
        credentials: options.credentials,
        jql: `key in (${batch.join(',')})`,
        fields,
        describe: `issues ${batch[0]}…`,
      }),
    ),
    map((resources) => resources.flatMap((resource) => toJiraIssue(resource, options.subjectField) ?? [])),
    reduce((all: JiraIssue[], issues) => [...all, ...issues], []),
  );
};

/** The key → id map Tempo needs before any worklog can be written. */
export const fetchJiraIssueIds$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  keys: string[];
}): Observable<Map<string, string>> =>
  fetchJiraIssues$(options).pipe(map((issues) => new Map(issues.map((issue) => [issue.key, issue.id]))));

/**
 * The id → key map a Tempo worklog needs to be readable, since Tempo references only the numeric id.
 * Ids Jira does not know are absent from the result rather than failing the day.
 */
export const fetchJiraIssueKeysByIds$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  ids: string[];
}): Observable<Map<string, string>> => {
  const ids = [...new Set(options.ids.map((id) => id.trim()).filter(Boolean))];

  if (ids.length === 0) return of(new Map<string, string>());

  return from(chunk(ids, KEYS_PER_REQUEST)).pipe(
    concatMap((batch) =>
      searchJiraIssues$({
        transport: options.transport,
        credentials: options.credentials,
        jql: `id in (${batch.join(',')})`,
        fields: ['summary'],
        describe: `issues by id ${batch[0]}…`,
      }),
    ),
    reduce((all: Map<string, string>, resources) => {
      for (const resource of resources) {
        if (resource.id && resource.key) all.set(resource.id, resource.key);
      }

      return all;
    }, new Map<string, string>()),
  );
};

/**
 * When Jira last recorded a change on each issue, by key.
 *
 * A key Jira does not know, or reports no `updated` for, is absent rather than dated. A ticket nobody
 * may read and a ticket nobody touches read the same from here, and only the second is worth a word.
 *
 * A worklog this app writes goes to Tempo's own API and never through Jira, so booking time to a
 * ticket does not keep this timestamp fresh. Without that, a record naming a dead ticket would keep
 * the ticket looking alive by booking to it.
 */
export const fetchJiraIssueTouchedAt$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  keys: string[];
}): Observable<Map<string, Date>> => {
  const keys = [...new Set(options.keys.map((key) => key.trim().toUpperCase()).filter(Boolean))];

  if (keys.length === 0) return of(new Map<string, Date>());

  return from(chunk(keys, KEYS_PER_REQUEST)).pipe(
    concatMap((batch) =>
      searchJiraIssues$({
        transport: options.transport,
        credentials: options.credentials,
        jql: `key in (${batch.join(',')})`,
        fields: ['updated'],
        describe: `when ${batch[0]}… last changed`,
      }),
    ),
    reduce((all: Map<string, Date>, resources) => {
      for (const resource of resources) {
        const updated = resource.fields?.updated;
        const at = updated ? new Date(updated) : undefined;

        if (resource.key && at && !Number.isNaN(at.getTime())) all.set(resource.key, at);
      }

      return all;
    }, new Map<string, Date>()),
  );
};
