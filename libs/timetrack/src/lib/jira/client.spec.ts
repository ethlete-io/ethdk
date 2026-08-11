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
