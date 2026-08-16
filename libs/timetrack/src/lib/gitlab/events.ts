/* eslint-disable @typescript-eslint/naming-convention -- GitLab's REST v4 wire format is snake_case. */
import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { GitLabCredentials, GitLabPagingOptions, gitlabPaged$ } from './client';

/**
 * One thing the user did in GitLab, as the events API reports it.
 *
 * This is the retroactive record of work that leaves no local trace at all: approving somebody else's
 * merge request, or commenting on one, happens entirely in a browser on a machine the git collector
 * has nothing to say about.
 */
export type GitLabEvent = {
  id: string;
  at: Date;
  /** GitLab's own wording — `pushed to`, `commented on`, `approved`, `accepted`, `opened`. */
  action: string;
  projectId: string;
  /** `MergeRequest`, `Note`, `Issue`, or absent for a push. */
  targetType?: string;
  /** The merge request this was about, whether the event named it directly or through a note. */
  mergeRequestIid?: string;
  title?: string;
  /** The pushed branch. A push says which ref it moved; nothing else in an event does. */
  branch?: string;
};

type GitLabEventResource = {
  id?: number | string;
  created_at?: string;
  action_name?: string;
  project_id?: number | string;
  target_type?: string;
  target_iid?: number | string;
  target_title?: string;
  push_data?: { ref?: string; ref_type?: string; commit_title?: string };
  note?: { noteable_type?: string; noteable_iid?: number | string; body?: string };
};

const pad = (value: number) => String(value).padStart(2, '0');

const dayOf = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/**
 * GitLab's `after` and `before` are **exclusive** dates, so a window that names the day itself comes
 * back empty. Both ends are moved one day out, and the instants are filtered afterwards.
 */
const boundary = (at: Date, byDays: number) => dayOf(new Date(at.getFullYear(), at.getMonth(), at.getDate() + byDays));

const mergeRequestIidOf = (resource: GitLabEventResource) => {
  if (resource.target_type === 'MergeRequest' && resource.target_iid !== undefined) return String(resource.target_iid);
  if (resource.note?.noteable_type === 'MergeRequest' && resource.note.noteable_iid !== undefined) {
    return String(resource.note.noteable_iid);
  }

  return undefined;
};

const toEvent = (resource: GitLabEventResource): GitLabEvent | undefined => {
  const at = resource.created_at ? new Date(resource.created_at) : undefined;

  if (resource.id === undefined || resource.project_id === undefined || !at || Number.isNaN(at.getTime())) {
    return undefined;
  }

  return {
    id: String(resource.id),
    at,
    action: resource.action_name ?? 'did something',
    projectId: String(resource.project_id),
    targetType: resource.target_type,
    mergeRequestIid: mergeRequestIidOf(resource),
    title: resource.target_title ?? resource.push_data?.commit_title,
    branch: resource.push_data?.ref_type === 'branch' ? resource.push_data.ref : undefined,
  };
};

/**
 * Everything the user did in GitLab inside the window, newest first as GitLab returns it.
 *
 * Only the user's own events are readable this way, which is exactly what is wanted: `/events` without
 * a project is scoped to the token's owner.
 */
export const fetchGitLabEvents$ = (options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  from: Date;
  to: Date;
  paging?: Partial<GitLabPagingOptions>;
}): Observable<GitLabEvent[]> =>
  gitlabPaged$<GitLabEventResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/events',
    describe: `your GitLab activity from ${dayOf(options.from)} to ${dayOf(options.to)}`,
    query: { after: boundary(options.from, -1), before: boundary(options.to, 1) },
    options: options.paging,
  }).pipe(
    map((resources) =>
      resources
        .flatMap((resource) => toEvent(resource) ?? [])
        .filter((event) => event.at >= options.from && event.at <= options.to),
    ),
  );
