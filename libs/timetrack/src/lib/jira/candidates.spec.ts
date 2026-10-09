import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { fetchJiraEpicChildren$, fetchJiraLoggedIssues$, fetchJiraParentCandidates$ } from './candidates';
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
      {
        key: 'FIP-1',
        id: '1',
        summary: 'User management',
        issueType: '',
        isSubtask: false,
        parentKey: undefined,
        subject: undefined,
      },
    ]);
  });

  it('offers no sub-task, which Jira accepts as a parent in no hierarchy', () => {
    const { transport } = fakeTransport([
      { id: '1', key: 'FIP-1', fields: { summary: 'The story', issuetype: { name: 'Story', subtask: false } } },
      { id: '2', key: 'FIP-2', fields: { summary: 'A step of it', issuetype: { name: 'Sub-task', subtask: true } } },
    ]);
    const seen = vi.fn();

    fetchJiraParentCandidates$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      issueTypeNames: [],
    }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]?.map((issue: { key: string }) => issue.key)).toEqual(['FIP-1']);
  });
});

describe('fetchJiraLoggedIssues$', () => {
  it('reads the logged keys of the project by key, so a done issue is read like an open one', () => {
    const { transport, requests } = fakeTransport([
      { id: '2', key: 'FIP-2', fields: { summary: 'Bracket challenge', issuetype: { name: 'Story' } } },
      { id: '1', key: 'FIP-1', fields: { summary: 'User management', issuetype: { name: 'Task' } } },
    ]);
    const seen = vi.fn();

    fetchJiraLoggedIssues$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      loggedKeys: ['FIP-1', 'ABC-9', 'fip-2', 'FIP-1'],
    }).subscribe(seen);

    expect(jqlOf(requests[0])).toBe('key in (FIP-1,FIP-2)');
    expect(seen.mock.calls[0]?.[0]?.map((issue: { key: string }) => issue.key)).toEqual(['FIP-1', 'FIP-2']);
  });

  it('asks Jira nothing when the history logged nothing in the project', () => {
    const { transport, requests } = fakeTransport([]);

    fetchJiraLoggedIssues$({
      transport,
      credentials: CREDENTIALS,
      projectKey: 'FIP',
      loggedKeys: ['ABC-9'],
    }).subscribe();

    expect(requests).toEqual([]);
  });
});

describe('fetchJiraEpicChildren$', () => {
  it('reads the open children of every epic in one read, most recently active first', () => {
    const { transport, requests } = fakeTransport([]);

    fetchJiraEpicChildren$({
      transport,
      credentials: CREDENTIALS,
      epicKeys: ['fifagg-12601', 'FIFAGG-12601', 'FIP-3'],
    }).subscribe();

    expect(requests).toHaveLength(1);
    expect(jqlOf(requests[0])).toBe(
      'parent in ("FIFAGG-12601", "FIP-3") AND statusCategory != Done ORDER BY updated DESC',
    );
  });

  it('reads nothing without an epic', () => {
    const { transport, requests } = fakeTransport([]);
    const seen: unknown[] = [];

    fetchJiraEpicChildren$({ transport, credentials: CREDENTIALS, epicKeys: [' ', 'nokey'] }).subscribe((issues) =>
      seen.push(issues),
    );

    expect(requests).toEqual([]);
    expect(seen).toEqual([[]]);
  });

  it('keeps the summary of the parent Jira sends with each child', () => {
    const { transport } = fakeTransport([
      {
        id: '1',
        key: 'FIFAGG-12704',
        fields: {
          summary: 'Reward pass claim flow',
          issuetype: { name: 'Story' },
          parent: { key: 'FIFAGG-12601', fields: { summary: 'Rewards' } },
        },
      },
    ]);
    const seen: unknown[] = [];

    fetchJiraEpicChildren$({ transport, credentials: CREDENTIALS, epicKeys: ['FIFAGG-12601'] }).subscribe((issues) =>
      seen.push(issues),
    );

    expect(seen).toEqual([
      [expect.objectContaining({ key: 'FIFAGG-12704', parentKey: 'FIFAGG-12601', parentSummary: 'Rewards' })],
    ]);
  });
});
