export type GitLabProject = { host: string; project: string };

export type GitLabMergeRequest = {
  iid: number;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
};

const TIMEOUT_MS = 15_000;

/** `git@host:group/sub/project.git`, `ssh://git@host:2222/group/project.git` and the https form. */
export const parseRemoteUrl = (url: string): GitLabProject | undefined => {
  const trimmed = url.trim();
  const scp = /^[^@/\s]+@([^:/\s]+):(.+?)(?:\.git)?\/?$/.exec(trimmed);

  if (scp?.[1] && scp[2]) return { host: scp[1], project: scp[2] };

  const withScheme = /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:\s]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/.exec(trimmed);

  if (withScheme?.[1] && withScheme[2]) return { host: withScheme[1], project: withScheme[2] };

  return undefined;
};

export const gitLabToken = () =>
  process.env['GITLAB_TOKEN']?.trim() || process.env['CI_JOB_TOKEN']?.trim() || undefined;

/* eslint-disable @typescript-eslint/naming-convention -- the GitLab REST wire format is snake_case. */
type MergeRequestResponse = {
  iid?: number;
  title?: string;
  source_branch?: string;
  target_branch?: string;
  web_url?: string;
};

const TARGET_BRANCH_FIELD = 'target_branch';
/* eslint-enable @typescript-eslint/naming-convention */

const toMergeRequest = (raw: MergeRequestResponse): GitLabMergeRequest => ({
  iid: raw.iid ?? 0,
  title: raw.title ?? '',
  sourceBranch: raw.source_branch ?? '',
  targetBranch: raw.target_branch ?? '',
  url: raw.web_url ?? '',
});

const request = async (options: {
  project: GitLabProject;
  token: string;
  path: string;
  method?: string;
  body?: Record<string, string>;
}) => {
  const { project, token, path, method, body } = options;
  const base = `https://${project.host}/api/v4/projects/${encodeURIComponent(project.project)}`;
  const response = await fetch(`${base}${path}`, {
    method: method ?? 'GET',
    headers: {
      'private-token': token,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `GitLab rejected the token (${response.status}) for ${project.project}. GITLAB_TOKEN needs the "api" scope and Developer access.`,
    );
  }

  if (!response.ok) {
    throw new Error(`GitLab responded ${response.status} ${response.statusText} for ${method ?? 'GET'} ${path}.`);
  }

  return { body: (await response.json()) as unknown, nextPage: response.headers.get('x-next-page') || undefined };
};

/**
 * Follows `x-next-page` rather than reading the first page only: a rename that silently skipped a
 * merge request on page two would leave exactly the half-finished state `repair` must never produce.
 */
const listMergeRequests = async (options: { project: GitLabProject; token: string; filter: string }) => {
  const { project, token, filter } = options;
  const found: GitLabMergeRequest[] = [];
  let page: string | undefined = '1';

  while (page) {
    const result = await request({
      project,
      token,
      path: `/merge_requests?state=opened&per_page=100&${filter}&page=${page}`,
    });

    found.push(...(result.body as MergeRequestResponse[]).map(toMergeRequest));
    page = result.nextPage;
  }

  return found;
};

/** Open merge requests whose source **or** target is the branch — both block a rename, differently. */
export const openMergeRequestsFor = async (options: {
  project: GitLabProject;
  token: string;
  branch: string;
}): Promise<GitLabMergeRequest[]> => {
  const { project, token, branch } = options;
  const encoded = encodeURIComponent(branch);
  const [fromBranch, intoBranch] = await Promise.all([
    listMergeRequests({ project, token, filter: `source_branch=${encoded}` }),
    listMergeRequests({ project, token, filter: `target_branch=${encoded}` }),
  ]);
  const byIid = new Map([...fromBranch, ...intoBranch].map((mr) => [mr.iid, mr]));

  return [...byIid.values()].sort((a, b) => a.iid - b.iid);
};

export const retargetMergeRequest = async (options: {
  project: GitLabProject;
  token: string;
  iid: number;
  target: string;
}) => {
  const { project, token, iid, target } = options;

  await request({
    project,
    token,
    path: `/merge_requests/${iid}`,
    method: 'PUT',
    body: { [TARGET_BRANCH_FIELD]: target },
  });
};

/**
 * The GitLab API can change a merge request's target branch but never its source branch, so an open
 * merge request *from* the branch cannot survive a rename — it has to be closed and reopened, which
 * loses its discussion. `repair` reports these and refuses rather than doing that to someone.
 */
export const blockingMergeRequests = (options: { mergeRequests: GitLabMergeRequest[]; branch: string }) =>
  options.mergeRequests.filter((mr) => mr.sourceBranch === options.branch);
