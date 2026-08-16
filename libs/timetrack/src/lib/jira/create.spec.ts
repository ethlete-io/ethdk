import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssueInput, createJiraIssue$ } from './create';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const INPUT: JiraIssueInput = {
  projectKey: 'FIP',
  issueTypeName: 'Task',
  summary: 'Rework the user management screen',
  description: 'From 17 commits.',
};

const fakeTransport = (bodies: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 201, headers: {}, body: bodies[requests.length - 1] ?? {} }) as never;
    }),
  };

  return { transport, requests };
};

const fieldsOf = (request: TimetrackRequest | undefined) =>
  (request?.body as { fields: Record<string, unknown> } | undefined)?.fields ?? {};

describe('createJiraIssue$', () => {
  it('posts the project, the type and an ADF description', () => {
    const { transport, requests } = fakeTransport([{ id: '10001', key: 'FIP-9' }]);

    createJiraIssue$({ transport, credentials: CREDENTIALS, input: INPUT }).subscribe();

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/issue');
    expect(fieldsOf(requests[0])).toMatchObject({
      project: { key: 'FIP' },
      issuetype: { name: 'Task' },
      summary: 'Rework the user management screen',
      description: { type: 'doc', version: 1 },
    });
  });

  it('reads back the key the work is then attributed to', () => {
    const { transport } = fakeTransport([{ id: '10001', key: 'FIP-9' }]);
    const seen = vi.fn();

    createJiraIssue$({ transport, credentials: CREDENTIALS, input: INPUT }).subscribe(seen);

    expect(seen).toHaveBeenCalledWith({ id: '10001', key: 'FIP-9' });
  });

  it('fails when the instance names no key, rather than reporting a success nothing can use', () => {
    const { transport } = fakeTransport([{ id: '10001' }]);
    const failed = vi.fn();

    createJiraIssue$({ transport, credentials: CREDENTIALS, input: INPUT }).subscribe({ error: failed });

    expect(failed.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('writes the branch subject only when the instance names a field for it', () => {
    const { transport, requests } = fakeTransport([
      { id: '1', key: 'FIP-9' },
      { id: '2', key: 'FIP-10' },
    ]);
    const input = { ...INPUT, subject: 'user-management' };

    createJiraIssue$({ transport, credentials: CREDENTIALS, input }).subscribe();
    createJiraIssue$({
      transport,
      credentials: CREDENTIALS,
      input: { ...input, subjectField: 'customfield_10057' },
    }).subscribe();

    expect(fieldsOf(requests[0])['customfield_10057']).toBeUndefined();
    expect(fieldsOf(requests[1])['customfield_10057']).toBe('user-management');
  });

  it('sets the parent field when the hierarchy can express the relation', () => {
    const { transport, requests } = fakeTransport([{ id: '1', key: 'FIP-9' }]);

    createJiraIssue$({
      transport,
      credentials: CREDENTIALS,
      input: { ...INPUT, parentKey: 'FIP-1', parenting: 'parent-field' },
    }).subscribe();

    expect(requests).toHaveLength(1);
    expect(fieldsOf(requests[0])['parent']).toEqual({ key: 'FIP-1' });
  });

  it('links to the parent instead when the instance has no level for it', () => {
    const { transport, requests } = fakeTransport([{ id: '1', key: 'FIP-9' }, {}]);
    const seen = vi.fn();

    createJiraIssue$({
      transport,
      credentials: CREDENTIALS,
      input: { ...INPUT, parentKey: 'FIP-1', parenting: 'issue-link', parentLinkType: 'Relates' },
    }).subscribe(seen);

    expect(fieldsOf(requests[0])['parent']).toBeUndefined();
    expect(requests[1]?.url).toContain('/rest/api/3/issueLink');
    expect(requests[1]?.body).toMatchObject({
      type: { name: 'Relates' },
      inwardIssue: { key: 'FIP-9' },
      outwardIssue: { key: 'FIP-1' },
    });
    expect(seen).toHaveBeenCalledWith({ id: '1', key: 'FIP-9' });
  });
});
