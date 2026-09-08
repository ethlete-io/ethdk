/* eslint-disable @typescript-eslint/naming-convention -- GitLab's REST v4 wire format is snake_case. */
import { FakeAnswer, FakeRoutedRequest, bodyOf, created, notFound, ok, stringOf } from './route';
import { FakeBackend, FakeGitLabEvent, FakeGitLabMergeRequest } from './types';

/** Empty, so `gitlabPaged$` stops after the first page instead of asking for the same one forever. */
const LIST_HEADERS = { 'x-next-page': '' };

/** The iid the first opened merge request gets. Specs name it, so it is a fixture value. */
const FIRST_CREATED_MERGE_REQUEST_IID = 42;

const list = (items: unknown[]): FakeAnswer => ({ status: 200, body: items, headers: LIST_HEADERS });

const mergeRequestResource = (mergeRequest: FakeGitLabMergeRequest, projectPath: string) => ({
  iid: mergeRequest.iid,
  project_id: mergeRequest.projectId,
  title: mergeRequest.title,
  source_branch: mergeRequest.sourceBranch,
  target_branch: mergeRequest.targetBranch,
  state: mergeRequest.state,
  web_url: mergeRequest.webUrl,
  references: { full: `${projectPath}!${mergeRequest.iid}` },
});

const eventResource = (event: FakeGitLabEvent) => ({
  id: event.id,
  created_at: event.at,
  action_name: event.actionName,
  project_id: event.projectId,
  ...(event.targetType ? { target_type: event.targetType } : {}),
  ...(event.targetTitle ? { target_title: event.targetTitle } : {}),
  ...(event.mergeRequestIid ? { target_iid: event.mergeRequestIid } : {}),
  ...(event.branch || event.commitTitle
    ? { push_data: { ref_type: 'branch', ref: event.branch, commit_title: event.commitTitle } }
    : {}),
});

const listMergeRequests = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const state = request.query.get('state');
  const sourceBranch = request.query.get('source_branch');
  const targetBranch = request.query.get('target_branch');

  const matched = backend.gitlab.mergeRequests.filter(
    (mergeRequest) =>
      (!state || mergeRequest.state === state) &&
      (!sourceBranch || mergeRequest.sourceBranch === sourceBranch) &&
      (!targetBranch || mergeRequest.targetBranch === targetBranch),
  );

  return list(matched.map((mergeRequest) => mergeRequestResource(mergeRequest, backend.gitlab.projectPath)));
};

const createMergeRequest = (options: {
  backend: FakeBackend;
  request: FakeRoutedRequest;
  projectId: string;
}): FakeAnswer => {
  const { backend, request, projectId } = options;
  const body = bodyOf(request);
  const sourceBranch = stringOf(body, 'source_branch');

  if (!sourceBranch) return { status: 400, body: { message: 'source_branch is required' } };

  const iid = String(FIRST_CREATED_MERGE_REQUEST_IID + backend.gitlab.created.length);
  const mergeRequest: FakeGitLabMergeRequest = {
    iid,
    projectId,
    title: stringOf(body, 'title') ?? '',
    sourceBranch,
    targetBranch: stringOf(body, 'target_branch') ?? '',
    state: 'opened',
    webUrl: `https://gitlab.example.com/${backend.gitlab.projectPath}/-/merge_requests/${iid}`,
  };

  backend.gitlab.mergeRequests = [...backend.gitlab.mergeRequests, mergeRequest];
  backend.gitlab.created = [...backend.gitlab.created, mergeRequest];

  return created(mergeRequestResource(mergeRequest, backend.gitlab.projectPath));
};

const updateMergeRequest = (options: { backend: FakeBackend; request: FakeRoutedRequest; iid: string }): FakeAnswer => {
  const { backend, request, iid } = options;
  const held = backend.gitlab.mergeRequests.find((mergeRequest) => mergeRequest.iid === iid);

  if (!held) return notFound(request);

  const body = bodyOf(request);
  const title = stringOf(body, 'title');
  const targetBranch = stringOf(body, 'target_branch');
  const next = {
    ...held,
    ...(title === undefined ? {} : { title }),
    ...(targetBranch === undefined ? {} : { targetBranch }),
  };

  backend.gitlab.mergeRequests = backend.gitlab.mergeRequests.map((mergeRequest) =>
    mergeRequest.iid === iid ? next : mergeRequest,
  );
  backend.gitlab.updates = [...backend.gitlab.updates, { iid, title, targetBranch }];

  return ok(mergeRequestResource(next, backend.gitlab.projectPath));
};

const readEvents = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const after = request.query.get('after') ?? '';
  const before = request.query.get('before') ?? '';

  const matched = backend.gitlab.events.filter((event) => {
    const day = event.at.slice(0, 10);

    return (!after || day > after) && (!before || day < before);
  });

  return list(matched.map(eventResource));
};

/** Answers a GitLab REST v4 call, and applies the writes to `backend.gitlab`. */
export const respondGitLab = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const path = request.path.replace(/^\/api\/v4/, '');

  if (path === '/events') return readEvents(backend, request);

  const forProject = /^\/projects\/([^/]+)\/merge_requests(?:\/(\d+))?$/.exec(path);

  if (!forProject) return notFound(request);

  const projectId = decodeURIComponent(forProject[1] ?? '');
  const iid = forProject[2];

  if (iid === undefined) {
    if (request.method === 'GET') return listMergeRequests(backend, request);
    if (request.method === 'POST') return createMergeRequest({ backend, request, projectId });

    return notFound(request);
  }

  if (request.method === 'PUT') return updateMergeRequest({ backend, request, iid });

  const held = backend.gitlab.mergeRequests.find((mergeRequest) => mergeRequest.iid === iid);

  return held ? ok(mergeRequestResource(held, backend.gitlab.projectPath)) : notFound(request);
};
