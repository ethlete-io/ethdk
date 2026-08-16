/* eslint-disable @typescript-eslint/naming-convention -- GitLab's REST v4 wire format is snake_case. */
import { Observable, forkJoin, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { GitLabCredentials, gitlabPaged$, gitlabRequest$ } from './client';

/** A merge request, reduced to what attribution and the evidence chain need. */
export type GitLabMergeRequest = {
  projectId: string;
  iid: string;
  title: string;
  /**
   * The branch the work is on. Under the branch grammar this carries the Story and the Task, which is
   * what lets time spent in somebody else's merge request land on the issue being reviewed.
   */
  sourceBranch: string;
  /** The branch it merges into. Empty for a merge request read by iid before this field was needed. */
  targetBranch: string;
  webUrl?: string;
  /** The path the instance shows, such as `braune-digital/fut-frontend`. */
  projectPath?: string;
};

type GitLabMergeRequestResource = {
  iid?: number | string;
  project_id?: number | string;
  title?: string;
  source_branch?: string;
  target_branch?: string;
  web_url?: string;
  references?: { full?: string };
};

const projectPathOf = (resource: GitLabMergeRequestResource) => {
  const full = resource.references?.full;

  return full ? full.split('!')[0] || undefined : undefined;
};

/**
 * One merge request by project and iid.
 *
 * A note event names the merge request it was left on but never its branch, so reviewing somebody
 * else's work is only attributable after this call. It is made once per merge request a day touched,
 * not once per event.
 */
export const fetchGitLabMergeRequest$ = (options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  projectId: string;
  iid: string;
}): Observable<GitLabMergeRequest | null> =>
  gitlabRequest$<GitLabMergeRequestResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/projects/${encodeURIComponent(options.projectId)}/merge_requests/${encodeURIComponent(options.iid)}`,
    describe: `merge request !${options.iid}`,
  }).pipe(
    map(({ body }) => {
      if (!body?.source_branch) return null;

      return {
        projectId: String(body.project_id ?? options.projectId),
        iid: String(body.iid ?? options.iid),
        title: body.title ?? '',
        sourceBranch: body.source_branch,
        targetBranch: body.target_branch ?? '',
        webUrl: body.web_url,
        projectPath: projectPathOf(body),
      };
    }),
  );

/**
 * The open merge requests that touch one branch — the ones from it and the ones into it.
 *
 * Both directions matter to a rename and for opposite reasons: a merge request *from* the branch
 * pins its name, because GitLab cannot move an open merge request to a different source branch, and
 * one *into* it has to be retargeted before the old name is deleted. GitLab has no way to ask for
 * either-or, so this is two filtered calls rather than a listing of every open merge request.
 */
export const fetchGitLabMergeRequestsForBranch$ = (options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  projectId: string;
  branch: string;
}): Observable<GitLabMergeRequest[]> => {
  const { transport, credentials, projectId, branch } = options;
  const page$ = (filter: 'source_branch' | 'target_branch') =>
    gitlabPaged$<GitLabMergeRequestResource>({
      transport,
      credentials,
      path: `/projects/${encodeURIComponent(projectId)}/merge_requests`,
      describe: `open merge requests with ${filter} ${branch}`,
      query: { state: 'opened', [filter]: branch },
    });

  return forkJoin([page$('source_branch'), page$('target_branch')]).pipe(
    map(([from, into]) => {
      const byIid = new Map(
        [...from, ...into]
          .filter((resource) => !!resource.source_branch)
          .map((resource): [string, GitLabMergeRequest] => {
            const iid = String(resource.iid ?? '');

            return [
              iid,
              {
                projectId: String(resource.project_id ?? projectId),
                iid,
                title: resource.title ?? '',
                sourceBranch: resource.source_branch ?? '',
                targetBranch: resource.target_branch ?? '',
                webUrl: resource.web_url,
                projectPath: projectPathOf(resource),
              },
            ];
          }),
      );

      return [...byIid.values()].sort((a, b) => Number(a.iid) - Number(b.iid));
    }),
  );
};

/**
 * Opens a merge request for a branch that was just pushed.
 *
 * GitLab has no `draft` field on the create call — the `Draft:` prefix in the title is the whole
 * mechanism, so a caller that drops it opens a merge request somebody can merge. Build the title
 * with `draftMergeRequestTitle`. The source branch is removed on merge, because the grammar makes
 * the name reconstructible and a stale branch is a collision the next start has to refuse.
 */
export const createGitLabMergeRequest$ = (options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  projectId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
}): Observable<GitLabMergeRequest> =>
  gitlabRequest$<GitLabMergeRequestResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/projects/${encodeURIComponent(options.projectId)}/merge_requests`,
    describe: `a merge request from ${options.sourceBranch} into ${options.targetBranch}`,
    method: 'POST',
    body: {
      source_branch: options.sourceBranch,
      target_branch: options.targetBranch,
      title: options.title,
      description: options.description,
      remove_source_branch: true,
    },
  }).pipe(
    map(({ body }) => {
      if (!body?.iid) {
        throw new Error(`GitLab accepted the merge request from ${options.sourceBranch} but returned no iid.`);
      }

      return {
        projectId: String(body.project_id ?? options.projectId),
        iid: String(body.iid),
        title: body.title ?? options.title,
        sourceBranch: body.source_branch ?? options.sourceBranch,
        targetBranch: body.target_branch ?? options.targetBranch,
        webUrl: body.web_url,
        projectPath: projectPathOf(body),
      };
    }),
  );

/**
 * Changes a merge request's title, its target branch, or both.
 *
 * The two are one call because a rename needs both and GitLab applies the whole `PUT` at once, so a
 * retarget can never land without the retitle that was planned beside it.
 */
export const updateGitLabMergeRequest$ = (options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  projectId: string;
  iid: string;
  title?: string;
  targetBranch?: string;
}): Observable<void> =>
  gitlabRequest$<unknown>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/projects/${encodeURIComponent(options.projectId)}/merge_requests/${encodeURIComponent(options.iid)}`,
    describe: `merge request !${options.iid}`,
    method: 'PUT',
    body: {
      ...(options.title === undefined ? {} : { title: options.title }),
      ...(options.targetBranch === undefined ? {} : { target_branch: options.targetBranch }),
    },
  }).pipe(map(() => undefined));
