/* eslint-disable @typescript-eslint/naming-convention -- GitLab's REST v4 wire format is snake_case. */
import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { GitLabCredentials, gitlabRequest$ } from './client';

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
  webUrl?: string;
  /** The path the instance shows, such as `braune-digital/fut-frontend`. */
  projectPath?: string;
};

type GitLabMergeRequestResource = {
  iid?: number | string;
  project_id?: number | string;
  title?: string;
  source_branch?: string;
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
        webUrl: body.web_url,
        projectPath: projectPathOf(body),
      };
    }),
  );
