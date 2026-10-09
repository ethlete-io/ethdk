import { filterByJql } from './jql';
import { FakeAnswer, FakeRoutedRequest, bodyOf, created, nestedOf, noContent, notFound, ok, stringOf } from './route';
import { FakeBackend, FakeJiraIssue } from './types';

const JIRA_PREFIX = '/rest/api/3';

/** The key the first filed issue gets. Specs name it, so it is a fixture value, not an accident. */
const FIRST_CREATED_ISSUE_NUMBER = 9999;

const parentOf = (issue: FakeJiraIssue, issues: readonly FakeJiraIssue[]) => {
  const summary = issues.find((held) => held.key === issue.parentKey)?.summary;

  return { key: issue.parentKey, ...(summary ? { fields: { summary } } : {}) };
};

const issueResource = (issue: FakeJiraIssue, fields: string[], issues: readonly FakeJiraIssue[] = []) => {
  const wanted = new Set(fields.length ? fields : ['summary', 'issuetype', 'parent', 'updated']);
  const custom = Object.entries(issue.custom ?? {}).filter(([id]) => wanted.has(id));

  return {
    id: issue.id,
    key: issue.key,
    fields: {
      ...(wanted.has('summary') ? { summary: issue.summary } : {}),
      ...(wanted.has('issuetype') ? { issuetype: { name: issue.issueType } } : {}),
      ...(wanted.has('parent') && issue.parentKey ? { parent: parentOf(issue, issues) } : {}),
      ...(wanted.has('updated') && issue.updated ? { updated: issue.updated } : {}),
      ...Object.fromEntries(custom),
    },
  };
};

const search = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const fields = (request.query.get('fields') ?? '').split(',').filter(Boolean);
  const matched = filterByJql(backend.jira.issues, request.query.get('jql') ?? '');

  return ok({ issues: matched.map((issue) => issueResource(issue, fields, backend.jira.issues)) });
};

const projectSearch = (backend: FakeBackend): FakeAnswer =>
  ok({ values: backend.jira.projects.map((project) => ({ key: project.key, name: project.name })), isLast: true });

const createIssue = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const fields = nestedOf(bodyOf(request), 'fields');
  const projectKey = stringOf(nestedOf(fields, 'project'), 'key') ?? 'ABC';
  const number = FIRST_CREATED_ISSUE_NUMBER + backend.jira.created.length;
  const known = new Set(['project', 'issuetype', 'summary', 'description', 'parent', 'assignee']);
  const custom = Object.fromEntries(Object.entries(fields).filter(([id]) => !known.has(id)));

  const issue: FakeJiraIssue = {
    id: String(backend.nextId++),
    key: `${projectKey}-${number}`,
    summary: stringOf(fields, 'summary') ?? '',
    issueType: stringOf(nestedOf(fields, 'issuetype'), 'name') ?? 'Task',
    parentKey: stringOf(nestedOf(fields, 'parent'), 'key'),
    assigneeAccountId: stringOf(nestedOf(fields, 'assignee'), 'accountId'),
    updated: new Date().toISOString(),
    ...(Object.keys(custom).length ? { custom } : {}),
  };

  backend.jira.issues = [issue, ...backend.jira.issues];
  backend.jira.created = [...backend.jira.created, issue];

  return created({ id: issue.id, key: issue.key });
};

const statusOf = (backend: FakeBackend, issue: FakeJiraIssue) =>
  issue.status ?? backend.jira.statuses[0]?.name ?? 'Backlog';

/**
 * Every move but the one the issue already stands in. A real workflow offers fewer, and a test that
 * needs a status nobody can reach names one the instance does not define at all.
 */
const transitionsFor = (backend: FakeBackend, issue: FakeJiraIssue) =>
  backend.jira.statuses
    .filter((status) => status.name !== statusOf(backend, issue))
    .map((status) => ({ id: `t${status.id}`, name: `Move to ${status.name}`, to: { name: status.name } }));

const readIssue = (backend: FakeBackend, read: { issueKey: string; request: FakeRoutedRequest }): FakeAnswer => {
  const { issueKey, request } = read;
  const issue = backend.jira.issues.find((held) => held.key === issueKey);

  if (!issue) return { status: 404, body: { errorMessages: ['Issue does not exist.'] } };

  const fields = (request.query.get('fields') ?? '').split(',').filter(Boolean);
  const resource = issueResource(issue, fields, backend.jira.issues);

  return ok(
    fields.includes('status')
      ? { ...resource, fields: { ...resource.fields, status: { name: statusOf(backend, issue) } } }
      : resource,
  );
};

const readTransitions = (backend: FakeBackend, issueKey: string): FakeAnswer => {
  const issue = backend.jira.issues.find((held) => held.key === issueKey);

  if (!issue) return { status: 404, body: { errorMessages: ['Issue does not exist.'] } };

  return ok({ transitions: transitionsFor(backend, issue) });
};

const writeTransition = (backend: FakeBackend, move: { issueKey: string; request: FakeRoutedRequest }): FakeAnswer => {
  const { issueKey, request } = move;
  const issue = backend.jira.issues.find((held) => held.key === issueKey);
  const id = stringOf(nestedOf(bodyOf(request), 'transition'), 'id');
  const wanted = issue && transitionsFor(backend, issue).find((transition) => transition.id === id);

  if (!issue) return { status: 404, body: { errorMessages: ['Issue does not exist.'] } };
  if (!wanted) return { status: 400, body: { errors: { transition: 'The issue does not offer that move.' } } };

  const moved = { ...issue, status: wanted.to.name };

  backend.jira.issues = backend.jira.issues.map((held) => (held.key === issueKey ? moved : held));
  backend.jira.created = backend.jira.created.map((held) => (held.key === issueKey ? moved : held));

  return noContent();
};

const linkIssues = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const body = bodyOf(request);
  const inwardKey = stringOf(nestedOf(body, 'inwardIssue'), 'key');
  const outwardKey = stringOf(nestedOf(body, 'outwardIssue'), 'key');

  if (!inwardKey || !outwardKey) return { status: 400, body: { errorMessages: ['A link needs both issues.'] } };

  backend.jira.links = [
    ...backend.jira.links,
    { type: stringOf(nestedOf(body, 'type'), 'name') ?? 'Relates', inwardKey, outwardKey },
  ];

  return { status: 201, body: {} };
};

/**
 * What the account may create in the project, which is not what the instance defines: a type named by
 * `notCreatable` stays in `/issuetype` and is left out here.
 */
const creatableTypes = (backend: FakeBackend) => {
  const refused = new Set(backend.jira.notCreatable.map((name) => name.toLowerCase()));

  return backend.jira.issueTypes.filter((type) => !refused.has(type.name.toLowerCase()));
};

const createMetaTypes = (backend: FakeBackend): FakeAnswer => {
  const issueTypes = creatableTypes(backend);

  return ok({ issueTypes, startAt: 0, maxResults: issueTypes.length, total: issueTypes.length });
};

const createMetaFields = (backend: FakeBackend, issueTypeId: string): FakeAnswer =>
  creatableTypes(backend).some((type) => type.id === issueTypeId)
    ? ok({
        fields: [{ fieldId: 'summary', key: 'summary', name: 'Summary', required: true }],
        startAt: 0,
        maxResults: 1,
        total: 1,
      })
    : ok({ fields: [], startAt: 0, maxResults: 0, total: 0 });

/** Answers a Jira Cloud REST v3 call, and applies the writes to `backend.jira`. */
export const respondJira = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const path = request.path.slice(JIRA_PREFIX.length);

  if (path === '/myself') return ok(backend.jira.self);
  if (path === '/search/jql') return search(backend, request);
  if (path === '/project/search') return projectSearch(backend);
  if (path === '/issuetype' || path === '/issuetype/project') return ok(backend.jira.issueTypes);
  if (/^\/issue\/createmeta\/[^/]+\/issuetypes$/.test(path)) return createMetaTypes(backend);

  const createMetaType = /^\/issue\/createmeta\/[^/]+\/issuetypes\/([^/]+)$/.exec(path);

  if (createMetaType) return createMetaFields(backend, decodeURIComponent(createMetaType[1] ?? ''));
  if (path === '/field') {
    return ok(
      backend.jira.fields.map((field) => ({
        id: field.id,
        name: field.name,
        custom: field.custom,
        ...(field.type ? { schema: { type: field.type } } : {}),
      })),
    );
  }
  if (path === '/status') return ok(backend.jira.statuses);
  if (path === '/issueLink' && request.method === 'POST') return linkIssues(backend, request);
  if (path === '/issue' && request.method === 'POST') return createIssue(backend, request);

  const transitions = /^\/issue\/([^/]+)\/transitions$/.exec(path);

  if (transitions) {
    const issueKey = decodeURIComponent(transitions[1] ?? '');

    return request.method === 'POST'
      ? writeTransition(backend, { issueKey, request })
      : readTransitions(backend, issueKey);
  }

  const issue = /^\/issue\/([^/]+)$/.exec(path);

  if (issue && request.method === 'GET')
    return readIssue(backend, { issueKey: decodeURIComponent(issue[1] ?? ''), request });

  return notFound(request);
};
