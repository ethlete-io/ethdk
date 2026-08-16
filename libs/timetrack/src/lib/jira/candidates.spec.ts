import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { fetchJiraParentCandidates$ } from './candidates';
import { JiraCredentials } from './client';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const fakeTransport = (issues: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: { issues } }) as never;
    }),
  };

  return { transport, requests };
};

const jqlOf = (request: TimetrackRequest | undefined) =>
  decodeURIComponent(new URL(request?.url ?? 'https://x').searchParams.get('jql') ?? '');

describe('fetchJiraParentCandidates$', () => {
  it('asks for the open issues of one project, most recently active first', () => {
    const { transport, requests } = fakeTransport([]);

    fetchJiraParentCandidates$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      issueTypeNames: ['Story', 'Epic'],
    }).subscribe();

    expect(jqlOf(requests[0])).toBe(
      'project = "FIP" AND statusCategory != Done AND issuetype in ("Story", "Epic") ORDER BY updated DESC',
    );
  });

  it('accepts any type when none is configured', () => {
    const { transport, requests } = fakeTransport([]);

    fetchJiraParentCandidates$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      issueTypeNames: [],
    }).subscribe();

    expect(jqlOf(requests[0])).not.toContain('issuetype');
  });

  it('escapes a quote in a project key rather than letting it end the literal', () => {
    const { transport, requests } = fakeTransport([]);

    fetchJiraParentCandidates$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'A" OR "B',
      issueTypeNames: [],
    }).subscribe();

    expect(jqlOf(requests[0])).toContain('project = "A\\" OR \\"B"');
  });

  it('reads one page and no more, so a picker never pages a project', () => {
    const { transport, requests } = fakeTransport([]);

    fetchJiraParentCandidates$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      issueTypeNames: [],
      limit: 5,
    }).subscribe();

    expect(requests[0]?.url).toContain('maxResults=5');
    expect(requests).toHaveLength(1);
  });

  it('drops a resource Jira returned without a key', () => {
    const { transport } = fakeTransport([
      { id: '1', key: 'FIP-1', fields: { summary: 'User management' } },
      { fields: { summary: 'Nameless' } },
    ]);
    const seen = vi.fn();

    fetchJiraParentCandidates$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      issueTypeNames: [],
    }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      { key: 'FIP-1', id: '1', summary: 'User management', issueType: '', parentKey: undefined, subject: undefined },
    ]);
  });
});
