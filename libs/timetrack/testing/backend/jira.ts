import { filterByJql } from './jql';
import { FakeAnswer, FakeRoutedRequest, bodyOf, created, nestedOf, notFound, ok, stringOf } from './route';
import { FakeBackend, FakeJiraIssue } from './types';

const JIRA_PREFIX = '/rest/api/3';

/** The key the first filed issue gets. Specs name it, so it is a fixture value, not an accident. */
const FIRST_CREATED_ISSUE_NUMBER = 9999;

const issueResource = (issue: FakeJiraIssue, fields: string[]) => {
  const wanted = new Set(fields.length ? fields : ['summary', 'issuetype', 'parent', 'updated']);
  const custom = Object.entries(issue.custom ?? {}).filter(([id]) => wanted.has(id));

  return {
    id: issue.id,
    key: issue.key,
    fields: {
      ...(wanted.has('summary') ? { summary: issue.summary } : {}),
      ...(wanted.has('issuetype') ? { issuetype: { name: issue.issueType } } : {}),
      ...(wanted.has('parent') && issue.parentKey ? { parent: { key: issue.parentKey } } : {}),
      ...(wanted.has('updated') && issue.updated ? { updated: issue.updated } : {}),
      ...Object.fromEntries(custom),
    },
  };
};

const search = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const fields = (request.query.get('fields') ?? '').split(',').filter(Boolean);
  const matched = filterByJql(backend.jira.issues, request.query.get('jql') ?? '');

  return ok({ issues: matched.map((issue) => issueResource(issue, fields)) });
};

const projectSearch = (backend: FakeBackend): FakeAnswer =>
  ok({ values: backend.jira.projects.map((project) => ({ key: project.key, name: project.name })), isLast: true });

const createIssue = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const fields = nestedOf(bodyOf(request), 'fields');
  const projectKey = stringOf(nestedOf(fields, 'project'), 'key') ?? 'ABC';
  const number = FIRST_CREATED_ISSUE_NUMBER + backend.jira.created.length;
  const known = new Set(['project', 'issuetype', 'summary', 'description', 'parent']);
  const custom = Object.fromEntries(Object.entries(fields).filter(([id]) => !known.has(id)));

  const issue: FakeJiraIssue = {
    id: String(backend.nextId++),
    key: `${projectKey}-${number}`,
    summary: stringOf(fields, 'summary') ?? '',
    issueType: stringOf(nestedOf(fields, 'issuetype'), 'name') ?? 'Task',
    parentKey: stringOf(nestedOf(fields, 'parent'), 'key'),
    updated: new Date().toISOString(),
    ...(Object.keys(custom).length ? { custom } : {}),
  };

  backend.jira.issues = [issue, ...backend.jira.issues];
  backend.jira.created = [...backend.jira.created, issue];

  return created({ id: issue.id, key: issue.key });
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

/** Answers a Jira Cloud REST v3 call, and applies the writes to `backend.jira`. */
export const respondJira = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const path = request.path.slice(JIRA_PREFIX.length);

  if (path === '/myself') return ok(backend.jira.self);
  if (path === '/search/jql') return search(backend, request);
  if (path === '/project/search') return projectSearch(backend);
  if (path === '/issuetype' || path === '/issuetype/project') return ok(backend.jira.issueTypes);
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
  if (path === '/issueLink' && request.method === 'POST') return linkIssues(backend, request);
  if (path === '/issue' && request.method === 'POST') return createIssue(backend, request);

  return notFound(request);
};
