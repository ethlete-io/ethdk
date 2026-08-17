import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { JiraCredentials, jiraRequest$ } from './client';

export type JiraIssueType = {
  id: string;
  name: string;
  subtask: boolean;
  /** Jira's own scale: 1 Epic, 0 Story/Task/Bug, -1 Sub-task. Premium plans add levels above 1. */
  hierarchyLevel: number;
};

/** How a child issue names its parent. The instance decides which of the two is even possible. */
export type JiraParenting = 'parent-field' | 'issue-link';

export type JiraHierarchyReport = {
  issueTypes: JiraIssueType[];
  /** The levels this instance actually has, highest first, with the type names sitting on each. */
  levels: { hierarchyLevel: number; typeNames: string[] }[];
  /**
   * What the levels imply, for settings to accept or override. Jira's default hierarchy puts Story
   * and Task on the *same* level, so "a Task under a Story" is only expressible through the parent
   * field when the instance has a type below the standard level or a custom level above it.
   */
  suggestedParenting: JiraParenting;
};

type JiraIssueTypeResource = {
  id?: string;
  name?: string;
  subtask?: boolean;
  hierarchyLevel?: number;
};

const toIssueType = (resource: JiraIssueTypeResource): JiraIssueType | undefined =>
  resource.id && resource.name
    ? {
        id: resource.id,
        name: resource.name,
        subtask: resource.subtask ?? false,
        hierarchyLevel: resource.hierarchyLevel ?? 0,
      }
    : undefined;

/** Every issue type the token can see, or only a project's when `projectId` is given. */
export const fetchJiraIssueTypes$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectId?: string;
}): Observable<JiraIssueType[]> =>
  jiraRequest$<JiraIssueTypeResource[]>({
    transport: options.transport,
    credentials: options.credentials,
    path: options.projectId ? '/rest/api/3/issuetype/project' : '/rest/api/3/issuetype',
    describe: options.projectId ? `issue types for project ${options.projectId}` : 'issue types',
    query: options.projectId ? { projectId: options.projectId } : undefined,
  }).pipe(map((resources) => resources.flatMap((resource) => toIssueType(resource) ?? [])));

const levelsOf = (issueTypes: JiraIssueType[]) => {
  const byLevel = new Map<number, string[]>();

  for (const issueType of issueTypes) {
    byLevel.set(issueType.hierarchyLevel, [...(byLevel.get(issueType.hierarchyLevel) ?? []), issueType.name]);
  }

  // Deduplicated by name: `/issuetype` returns one entry per issue-type scheme, so an instance with
  // four project schemes reports "Task" four times, at the same level and with different ids.
  return [...byLevel]
    .sort(([a], [b]) => b - a)
    .map(([hierarchyLevel, typeNames]) => ({ hierarchyLevel, typeNames: [...new Set(typeNames)].sort() }));
};

/**
 * Reads the instance's real hierarchy at setup, rather than assuming the convention's Story → Task.
 * Filing tickets at the wrong level is worse than having no create flow at all, so this reports what
 * the instance can express and leaves the choice to per-project settings.
 */
export const describeJiraHierarchy$ = (options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  projectId?: string;
}): Observable<JiraHierarchyReport> =>
  fetchJiraIssueTypes$(options).pipe(
    map((issueTypes) => ({
      issueTypes,
      levels: levelsOf(issueTypes),
      suggestedParenting: issueTypes.some((issueType) => issueType.subtask || issueType.hierarchyLevel !== 0)
        ? ('parent-field' as const)
        : ('issue-link' as const),
    })),
  );
