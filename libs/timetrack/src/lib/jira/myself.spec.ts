import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { fetchJiraMyself$ } from './myself';

const CREDENTIALS: JiraCredentials = { host: 'team.atlassian.net', email: 'me@example.com', token: 't' };

const myselfTransport = (body: unknown, status = 200) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

describe('fetchJiraMyself$', () => {
  it('reads the account the token authenticates as', () => {
    const { transport, requests } = myselfTransport({
      accountId: 'acc:123',
      displayName: 'Tom',
      emailAddress: 'me@example.com',
    });
    const seen = vi.fn();

    fetchJiraMyself$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/myself');
    expect(seen).toHaveBeenCalledWith({ accountId: 'acc:123', displayName: 'Tom', emailAddress: 'me@example.com' });
  });

  it('fails rather than resolving when jira answers without an account id', () => {
    const { transport } = myselfTransport({ displayName: 'Tom' });
    const failed = vi.fn();

    fetchJiraMyself$({ transport, credentials: CREDENTIALS }).subscribe({ error: failed });

    expect(failed.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('reports a rejected token as a jira request error', () => {
    const { transport } = myselfTransport({}, 401);
    const failed = vi.fn();

    fetchJiraMyself$({ transport, credentials: CREDENTIALS }).subscribe({ error: failed });

    expect(failed.mock.calls[0]?.[0]).toMatchObject({ name: 'JiraRequestError', status: 401 });
  });
});
