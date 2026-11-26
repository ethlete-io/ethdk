import { Observable, map } from 'rxjs';
import { projectKeyOf } from '../ticket/project';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssue, toJiraIssue } from './issue';
import { JiraIssueResource, searchJiraIssues$ } from './search';

/** One issue of a project as the local mirror holds it. */
export type JiraMirrorIssue = JiraIssue & { done: boolean; updatedMs: number };

/**
 * A project's open issues and the ones closed in the last {@link JIRA_MIRROR_CLOSED_DAYS} days, read
 * whole at `fullAtMs` and kept current by reads of what changed since `syncedAtMs`.
 */
export type JiraMirror = {
  projectKey: string;
  fullAtMs: number;
  syncedAtMs: number;
  issues: JiraMirrorIssue[];
};

export const JIRA_MIRROR_CLOSED_DAYS = 30;

/** How often a mirror reads what changed while the app runs. */
export const JIRA_MIRROR_SYNC_MS = 20 * 60_000;

/** How often a mirror is read whole, which is the only read that drops a deleted or moved issue. */
export const JIRA_MIRROR_FULL_READ_MS = 24 * 60 * 60_000;

/** A change read covers this much before the last read, so an edit Jira indexed late is not missed. */
const CHANGE_READ_OVERLAP_MS = 5 * 60_000;

const MIRROR_MAX_PAGES = 50;

const DAY_MS = 24 * 60 * 60_000;

const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const toMirrorIssue = (resource: JiraIssueResource, subjectField?: string): JiraMirrorIssue | undefined => {
  const issue = toJiraIssue(resource, subjectField);

  if (!issue) return undefined;

  const status = resource.fields?.['status'] as { statusCategory?: { key?: string } } | undefined;
  const updatedMs = Date.parse(resource.fields?.updated ?? '');

  return { ...issue, done: status?.statusCategory?.key === 'done', updatedMs: Number.isNaN(updatedMs) ? 0 : updatedMs };
};

/**
 * Reads one project for its mirror: every open issue and every issue updated in the last
 * {@link JIRA_MIRROR_CLOSED_DAYS} days, or, given `sinceMs`, every issue updated since then.
 */
export const fetchJiraMirrorIssues$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  nowMs: number;
  sinceMs?: number;
  subjectField?: string;
}): Observable<JiraMirrorIssue[]> => {
  const { projectKey, sinceMs, subjectField } = options;
  const window =
    sinceMs === undefined
      ? `(statusCategory != Done OR updated >= -${JIRA_MIRROR_CLOSED_DAYS}d)`
      : `updated >= -${Math.max(1, Math.ceil((options.nowMs - sinceMs + CHANGE_READ_OVERLAP_MS) / 60_000))}m`;

  return searchJiraIssues$({
    transport: options.transport,
    credentials: options.credentials,
    jql: `project = ${quoted(projectKey)} AND ${window} ORDER BY updated DESC`,
    fields: ['summary', 'issuetype', 'parent', 'status', 'updated', ...(subjectField ? [subjectField] : [])],
    describe: `the issues of ${projectKey}`,
    options: { maxPages: MIRROR_MAX_PAGES },
  }).pipe(map((resources) => resources.flatMap((resource) => toMirrorIssue(resource, subjectField) ?? [])));
};

/**
 * `held` with `read` laid over it: an issue read replaces the held one with its id or key, an issue of
 * another project and a done one older than {@link JIRA_MIRROR_CLOSED_DAYS} days go.
 */
export const mergeJiraMirror = (options: {
  held: JiraMirror | null;
  read: readonly JiraMirrorIssue[];
  projectKey: string;
  nowMs: number;
  full: boolean;
}): JiraMirror => {
  const projectKey = options.projectKey.trim().toUpperCase();
  const readIds = new Set(options.read.map((issue) => issue.id));
  const readKeys = new Set(options.read.map((issue) => issue.key.toUpperCase()));
  const kept = options.full
    ? []
    : (options.held?.issues ?? []).filter((issue) => !readIds.has(issue.id) && !readKeys.has(issue.key.toUpperCase()));
  const closedSince = options.nowMs - JIRA_MIRROR_CLOSED_DAYS * DAY_MS;

  return {
    projectKey,
    fullAtMs: options.full ? options.nowMs : (options.held?.fullAtMs ?? options.nowMs),
    syncedAtMs: options.nowMs,
    issues: [...options.read, ...kept]
      .filter((issue) => projectKeyOf(issue.key) === projectKey && (!issue.done || issue.updatedMs >= closedSince))
      .sort((a, b) => b.updatedMs - a.updatedMs),
  };
};

/** Whether a mirror read now reads the project whole rather than only what changed. */
export const jiraMirrorNeedsFullRead = (held: JiraMirror | null, nowMs: number) =>
  !held || nowMs - held.fullAtMs >= JIRA_MIRROR_FULL_READ_MS || nowMs < held.fullAtMs;

/** Reads one project into its mirror. A failed read errors and leaves `held` to the caller. */
export const syncJiraMirror$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectKey: string;
  held: JiraMirror | null;
  nowMs: number;
  subjectField?: string;
}): Observable<JiraMirror> => {
  const { held, nowMs } = options;
  const full = jiraMirrorNeedsFullRead(held, nowMs);

  return fetchJiraMirrorIssues$({ ...options, ...(full || !held ? {} : { sinceMs: held.syncedAtMs }) }).pipe(
    map((read) => mergeJiraMirror({ held, read, projectKey: options.projectKey, nowMs, full })),
  );
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const parseMirrorIssue = (value: unknown): JiraMirrorIssue[] => {
  const raw = asRecord(value);
  const { key, id, summary, issueType, updatedMs } = raw;

  if (typeof key !== 'string' || typeof id !== 'string' || typeof summary !== 'string') return [];

  const text = (field: string) => (typeof raw[field] === 'string' ? { [field]: raw[field] as string } : {});

  return [
    {
      key,
      id,
      summary,
      issueType: typeof issueType === 'string' ? issueType : '',
      ...(raw['isSubtask'] === true ? { isSubtask: true } : {}),
      ...text('parentKey'),
      ...text('parentSummary'),
      ...text('subject'),
      done: raw['done'] === true,
      updatedMs: typeof updatedMs === 'number' ? updatedMs : 0,
    },
  ];
};

/** A stored mirror, or `null` for a document that is not one. */
export const parseJiraMirror = (value: unknown): JiraMirror | null => {
  const raw = asRecord(value);
  const { projectKey, fullAtMs, syncedAtMs, issues } = raw;

  if (typeof projectKey !== 'string' || typeof fullAtMs !== 'number' || typeof syncedAtMs !== 'number') return null;

  return {
    projectKey,
    fullAtMs,
    syncedAtMs,
    issues: Array.isArray(issues) ? issues.flatMap(parseMirrorIssue) : [],
  };
};
