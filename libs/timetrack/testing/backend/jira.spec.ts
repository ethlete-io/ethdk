import { describe, expect, it } from 'vitest';
import { E2E_ISSUE_ID, E2E_ISSUE_KEY, E2E_PARENT_KEY, createFakeWorld } from '../world';
import { respondJira } from './jira';
import { FakeBackend } from './types';

const backendOf = (seed: Parameters<typeof createFakeWorld>[0] = {}) => createFakeWorld(seed).backend;

const get = (backend: FakeBackend, path: string, query: Record<string, string> = {}) =>
  respondJira(backend, {
    method: 'GET',
    path: `/rest/api/3${path}`,
    query: new URLSearchParams(query),
    body: undefined,
  });

const post = (backend: FakeBackend, path: string, body: unknown) =>
  respondJira(backend, {
    method: 'POST',
    path: `/rest/api/3${path}`,
    query: new URLSearchParams(),
    body,
  });

type IssueResource = { id: string; key: string; fields: Record<string, unknown> };

const issuesOf = (body: unknown) => (body as { issues: IssueResource[] }).issues;

const newIssue = (summary: string, extra: Record<string, unknown> = {}) => ({
  fields: { project: { key: 'ABC' }, issuetype: { name: 'Task' }, summary, ...extra },
});

describe('respondJira', () => {
  it('answers the seeded account for /myself', () => {
    const answer = get(backendOf(), '/myself');

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ emailAddress: 'e2e@example.com' });
  });

  it('adds an issue a later search returns', () => {
    const backend = backendOf();

    const filed = post(backend, '/issue', newIssue('Export the invoice as a PDF'));

    expect(filed.status).toBe(201);
    expect(filed.body).toEqual({ id: '11000', key: 'ABC-9999' });

    const found = get(backend, '/search/jql', { jql: 'key in ("ABC-9999")', fields: 'summary' });

    expect(issuesOf(found.body).map((issue) => issue.fields['summary'])).toEqual(['Export the invoice as a PDF']);
  });

  it('numbers filed issues from 9999 upwards, so a spec can name the key it will get', () => {
    const backend = backendOf();

    post(backend, '/issue', newIssue('First'));
    post(backend, '/issue', newIssue('Second'));

    expect(backend.jira.created.map((issue) => issue.key)).toEqual(['ABC-9999', 'ABC-10000']);
  });

  it('files the issue under the project the body names', () => {
    const backend = backendOf();

    post(backend, '/issue', { fields: { project: { key: 'ZZZ' }, issuetype: { name: 'Task' }, summary: 'x' } });

    expect(backend.jira.created[0]?.key).toBe('ZZZ-9999');
  });

  it('keeps a custom field the create wrote, and returns it when a search asks for it', () => {
    const backend = backendOf();

    post(backend, '/issue', newIssue('User management', { customfield_10057: 'user-management' }));

    const found = get(backend, '/search/jql', { jql: 'key = "ABC-9999"', fields: 'summary,customfield_10057' });

    expect(issuesOf(found.body)[0]?.fields['customfield_10057']).toBe('user-management');
  });

  it('records a link between two issues', () => {
    const backend = backendOf();

    const answer = post(backend, '/issueLink', {
      type: { name: 'Blocks' },
      inwardIssue: { key: E2E_ISSUE_KEY },
      outwardIssue: { key: E2E_PARENT_KEY },
    });

    expect(answer.status).toBe(201);
    expect(backend.jira.links).toEqual([{ type: 'Blocks', inwardKey: E2E_ISSUE_KEY, outwardKey: E2E_PARENT_KEY }]);
  });

  it('refuses a link that names only one issue', () => {
    const backend = backendOf();

    const answer = post(backend, '/issueLink', { type: { name: 'Blocks' }, inwardIssue: { key: E2E_ISSUE_KEY } });

    expect(answer.status).toBe(400);
    expect(backend.jira.links).toEqual([]);
  });

  it('answers the project page as the last one, so the picker stops paging', () => {
    expect(get(backendOf(), '/project/search').body).toEqual({ values: [{ key: 'ABC', name: 'Alpha' }], isLast: true });
  });

  it('reports a custom field with its schema type', () => {
    const fields = get(backendOf(), '/field').body as { id: string; custom: boolean; schema?: { type: string } }[];

    expect(fields.find((field) => field.id === 'customfield_10057')).toEqual({
      id: 'customfield_10057',
      name: 'Branch subject',
      custom: true,
      schema: { type: 'string' },
    });
  });

  it('names the parent of a subtask only when the issue has one', () => {
    const backend = backendOf({
      jira: { issues: [{ id: '1', key: 'ABC-1', summary: 'Child', issueType: 'Task', parentKey: E2E_PARENT_KEY }] },
    });

    const found = get(backend, '/search/jql', { jql: 'key = "ABC-1"', fields: 'summary,parent' });

    expect(issuesOf(found.body)[0]?.fields).toEqual({ summary: 'Child', parent: { key: E2E_PARENT_KEY } });
  });

  it('returns the default field set when a search names no fields', () => {
    const found = get(backendOf(), '/search/jql', { jql: `id = "${E2E_ISSUE_ID}"` });

    expect(Object.keys(issuesOf(found.body)[0]?.fields ?? {})).toEqual(['summary', 'issuetype', 'updated']);
  });

  it('answers 404 for a Jira path it does not route', () => {
    const answer = get(backendOf(), '/issue/ABC-1/transitions');

    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({
      errorMessages: [expect.stringContaining('/rest/api/3/issue/ABC-1/transitions')],
    });
  });
});
