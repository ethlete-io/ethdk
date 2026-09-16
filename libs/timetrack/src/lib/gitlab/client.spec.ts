import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { GitLabCredentials, GitLabRequestError, gitlabRequest$, normalizeGitLabHost } from './client';

const CREDENTIALS: GitLabCredentials = {
  host: 'https://git.example.com',
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

describe('normalizeGitLabHost', () => {
  it('adds a scheme and drops trailing slashes', () => {
    expect(normalizeGitLabHost('git.example.com/')).toBe('https://git.example.com');
    expect(normalizeGitLabHost('https://git.example.com///')).toBe('https://git.example.com');
  });
});

describe('gitlabRequest$', () => {
  it('builds the url from the host, the api prefix and the query', () => {
    const { transport, requests } = transportOf();

    gitlabRequest$({
      transport,
      credentials: { ...CREDENTIALS, host: 'git.example.com/' },
      path: '/merge_requests',
      describe: 'your merge requests',
      query: { scope: 'all' },
    }).subscribe();

    expect(requests[0]?.url).toBe('https://git.example.com/api/v4/merge_requests?scope=all');
    expect(requests[0]?.headers?.['private-token']).toBe('secret-token');
  });

  it('refuses a host that is not https before the token reaches the transport', () => {
    const { transport, requests } = transportOf();
    const errors: Error[] = [];

    gitlabRequest$({
      transport,
      credentials: { ...CREDENTIALS, host: 'http://git.example.com' },
      path: '/merge_requests',
      describe: 'your merge requests',
    }).subscribe({ error: (error: Error) => errors.push(error) });

    expect(requests).toHaveLength(0);
    expect(errors[0]).toBeInstanceOf(GitLabRequestError);
    expect(errors[0]?.message).toContain('is not https');
  });
});
