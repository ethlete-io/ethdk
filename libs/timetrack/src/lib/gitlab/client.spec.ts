import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import {
  GitLabCredentials,
  GitLabRequestError,
  gitlabRequest$,
  isSameGitLabInstance,
  normalizeGitLabHost,
} from './client';

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

  it('keeps a scheme written in capitals', () => {
    expect(normalizeGitLabHost('HTTPS://git.example.com/')).toBe('HTTPS://git.example.com');
    expect(new URL(normalizeGitLabHost('Https://git.example.com')).hostname).toBe('git.example.com');
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

  it.each([
    [{ message: ['Another open merge request already exists for this source branch'] }, 'Another open merge request'],
    [{ message: { source_branch: ['is invalid'] } }, 'source_branch is invalid'],
    [{ message: '400 Bad request - title is missing' }, 'title is missing'],
    [{ error: 'invalid_token' }, 'invalid_token'],
  ])('appends the reason GitLab gave to a refusal: %j', (body, reason) => {
    const { transport } = transportOf(422, body);
    const errors: Error[] = [];

    gitlabRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/projects/1/merge_requests',
      describe: 'the merge request',
      method: 'POST',
    }).subscribe({ error: (error: Error) => errors.push(error) });

    expect(errors[0]?.message).toContain(reason);
  });
});

describe('isSameGitLabInstance', () => {
  it('compares hostnames, whatever scheme, port or path either side carries', () => {
    expect(isSameGitLabInstance('https://git.example.com:8443/', 'git.example.com')).toBe(true);
    expect(isSameGitLabInstance('http://Git.Example.com', 'git.example.com')).toBe(true);
    expect(isSameGitLabInstance('git.example.com', 'gitlab.example.com')).toBe(false);
  });
});

describe('gitlabRequest$ on a rate limit', () => {
  afterEach(() => vi.useRealTimers());

  const answering = (...responses: { status: number; headers?: Record<string, string> }[]) => {
    let call = 0;

    return {
      request$: vi.fn(() => {
        const response = responses[Math.min(call++, responses.length - 1)];

        return of({ headers: {}, body: { id: 1 }, ...response }) as never;
      }),
    } satisfies TimetrackTransport;
  };

  const request$ = (transport: TimetrackTransport) =>
    gitlabRequest$({ transport, credentials: CREDENTIALS, path: '/user', describe: 'you' });

  it('asks again after the wait GitLab named', () => {
    vi.useFakeTimers();

    const transport = answering({ status: 429, headers: { 'retry-after': '5' } }, { status: 200 });
    const seen = vi.fn();

    request$(transport).subscribe(seen);
    vi.advanceTimersByTime(5_000);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(transport.request$).toHaveBeenCalledTimes(2);
  });

  it('gives up after a bounded number of retries with a rate-limit error', () => {
    vi.useFakeTimers();

    const transport = answering({ status: 429 });
    const failed = vi.fn();

    request$(transport).subscribe({ error: failed });
    vi.runAllTimers();

    expect((failed.mock.calls[0]?.[0] as GitLabRequestError).status).toBe(429);
    expect(transport.request$).toHaveBeenCalledTimes(3);
  });
});
