import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials, JiraRequestError, jiraRequest$, normalizeJiraHost } from './client';

const CREDENTIALS: JiraCredentials = {
  host: 'https://team.atlassian.net',
  email: 'you@example.com',
  token: 'secret-token',
};

const transportOf = (status = 200, body: unknown = {}) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

describe('normalizeJiraHost', () => {
  it('adds a scheme and drops trailing slashes', () => {
    expect(normalizeJiraHost('team.atlassian.net/')).toBe('https://team.atlassian.net');
    expect(normalizeJiraHost('https://team.atlassian.net///')).toBe('https://team.atlassian.net');
  });
});

describe('jiraRequest$', () => {
  it('builds the url from the host, path and query', () => {
    const { transport, requests } = transportOf();

    jiraRequest$({
      transport,
      credentials: { ...CREDENTIALS, host: 'team.atlassian.net/' },
      path: '/rest/api/3/issuetype',
      describe: 'issue types',
      query: { projectId: '10001' },
    }).subscribe();

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/issuetype?projectId=10001');
    expect(requests[0]?.method).toBe('GET');
  });

  it('refuses a host that is not https before the token reaches the transport', () => {
    const { transport, requests } = transportOf();
    const errors: Error[] = [];

    jiraRequest$({
      transport,
      credentials: { ...CREDENTIALS, host: 'http://jira.example' },
      path: '/rest/api/3/myself',
      describe: 'the account',
    }).subscribe({ error: (error: Error) => errors.push(error) });

    expect(requests).toHaveLength(0);
    expect(errors[0]).toBeInstanceOf(JiraRequestError);
    expect(errors[0]?.message).toContain('is not https');
  });

  it('drops undefined query values rather than sending the string "undefined"', () => {
    const { transport, requests } = transportOf();

    jiraRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/x',
      describe: 'x',
      query: { a: '1', nextPageToken: undefined },
    }).subscribe();

    expect(requests[0]?.url).toBe('https://team.atlassian.net/x?a=1');
  });

  it('sends the api token as basic auth over the account email', () => {
    const { transport, requests } = transportOf();

    jiraRequest$({ transport, credentials: CREDENTIALS, path: '/x', describe: 'x' }).subscribe();

    expect(requests[0]?.headers?.['authorization']).toBe(`Basic ${btoa('you@example.com:secret-token')}`);
  });

  it('encodes a non-ascii email as utf-8 instead of throwing', () => {
    const { transport, requests } = transportOf();

    jiraRequest$({
      transport,
      credentials: { ...CREDENTIALS, email: 'jörg@example.com' },
      path: '/x',
      describe: 'x',
    }).subscribe();

    expect(requests[0]?.headers?.['authorization']).toMatch(/^Basic /);
  });

  it('sets a content type only when there is a body', () => {
    const { transport, requests } = transportOf();

    jiraRequest$({ transport, credentials: CREDENTIALS, path: '/x', describe: 'x' }).subscribe();
    jiraRequest$({ transport, credentials: CREDENTIALS, path: '/x', describe: 'x', body: {} }).subscribe();

    expect(requests[0]?.headers?.['content-type']).toBeUndefined();
    expect(requests[1]?.headers?.['content-type']).toBe('application/json');
  });

  it('reports a rejected credential distinctly from a missing resource', () => {
    const unauthorized = vi.fn();
    const missing = vi.fn();

    jiraRequest$({
      transport: transportOf(401).transport,
      credentials: CREDENTIALS,
      path: '/x',
      describe: 'issue FIP-1',
    }).subscribe({ error: unauthorized });
    jiraRequest$({
      transport: transportOf(404).transport,
      credentials: CREDENTIALS,
      path: '/x',
      describe: 'issue FIP-1',
    }).subscribe({ error: missing });

    expect(unauthorized.mock.calls[0]?.[0]).toBeInstanceOf(JiraRequestError);
    expect(unauthorized.mock.calls[0]?.[0].status).toBe(401);
    expect(unauthorized.mock.calls[0]?.[0].message).toContain('credentials');
    expect(missing.mock.calls[0]?.[0].message).toContain('has no issue FIP-1');
  });

  it('passes a successful body straight through', () => {
    const seen = vi.fn();

    jiraRequest$({
      transport: transportOf(200, { ok: true }).transport,
      credentials: CREDENTIALS,
      path: '/x',
      describe: 'x',
    }).subscribe(seen);

    expect(seen).toHaveBeenCalledWith({ ok: true });
  });
});

describe('what a rejected call says went wrong', () => {
  const failWith = (status: number, body: unknown) => {
    const { transport } = transportOf(status, body);
    const failed = vi.fn();

    jiraRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/rest/api/3/issue',
      describe: 'a new Task in FIP',
    }).subscribe({ error: failed });

    return (failed.mock.calls[0]?.[0] as JiraRequestError).message;
  };

  it('names the field Jira rejected, which is the only part that says what to change', () => {
    const message = failWith(400, { errors: { customfield_10011: 'Epic Name is required.' } });

    expect(message).toContain('customfield_10011: Epic Name is required.');
    expect(message).toContain('a new Task in FIP');
  });

  it('carries a general message that names no field', () => {
    expect(failWith(400, { errorMessages: ['Field parent cannot be set.'] })).toContain('Field parent cannot be set.');
  });

  it('reports both lists, so neither half of the answer is dropped', () => {
    const message = failWith(400, {
      errorMessages: ['The issue type is not valid.'],
      errors: { summary: 'Summary is required.' },
    });

    expect(message).toContain('The issue type is not valid.');
    expect(message).toContain('summary: Summary is required.');
  });

  it('stays a bare status where Jira sent no reason', () => {
    expect(failWith(400, {})).toBe('Jira responded 400 for a new Task in FIP.');
    expect(failWith(400, { errors: {}, errorMessages: [] })).toBe('Jira responded 400 for a new Task in FIP.');
  });

  it('cuts a long answer, so one rejection cannot fill the banner', () => {
    expect(failWith(400, { errorMessages: ['x'.repeat(900)] }).length).toBeLessThan(400);
  });

  it('adds the reason to a rejection the status alone already explains', () => {
    expect(failWith(403, { errorMessages: ['You do not have permission to create issues.'] })).toContain(
      'You do not have permission to create issues.',
    );
  });
});
