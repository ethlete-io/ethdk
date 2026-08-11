import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssueResource } from './search';
import { fetchJiraIssueIds$, fetchJiraIssueKeysByIds$, fetchJiraIssues$ } from './issue';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const issuesTransport = (issues: JiraIssueResource[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);
      const wanted = decodeURIComponent(/jql=([^&]*)/.exec(request.url)?.[1] ?? '');

      return of({
        status: 200,
        headers: {},
        body: { issues: issues.filter((issue) => issue.key && wanted.includes(issue.key)) },
      }) as never;
    }),
  };

  return { transport, requests };
};

const STORY: JiraIssueResource = {
  id: '10101',
  key: 'FIP-2177',
  fields: { summary: 'User management', issuetype: { name: 'Story' } },
};

const TASK: JiraIssueResource = {
  id: '10102',
  key: 'FIP-2178',
  fields: { summary: 'Password reset', issuetype: { name: 'Task' }, parent: { key: 'FIP-2177' } },
};

describe('fetchJiraIssues$', () => {
  it('resolves keys to ids, summaries and parents', () => {
    const { transport } = issuesTransport([STORY, TASK]);
    const seen = vi.fn();

    fetchJiraIssues$({ transport, credentials: CREDENTIALS, keys: ['FIP-2177', 'FIP-2178'] }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      { key: 'FIP-2177', id: '10101', summary: 'User management', issueType: 'Story', parentKey: undefined },
      { key: 'FIP-2178', id: '10102', summary: 'Password reset', issueType: 'Task', parentKey: 'FIP-2177' },
    ]);
  });

  it('normalizes and dedupes the keys before asking', () => {
    const { transport, requests } = issuesTransport([STORY]);

    fetchJiraIssues$({ transport, credentials: CREDENTIALS, keys: ['fip-2177', 'FIP-2177', ' FIP-2177 '] }).subscribe();

    expect(requests).toHaveLength(1);
    expect(decodeURIComponent(requests[0]?.url ?? '')).toContain('key in (FIP-2177)');
  });

  it('asks for nothing when there are no keys', () => {
    const { transport, requests } = issuesTransport([]);
    const seen = vi.fn();

    fetchJiraIssues$({ transport, credentials: CREDENTIALS, keys: [] }).subscribe(seen);

    expect(requests).toHaveLength(0);
    expect(seen).toHaveBeenCalledWith([]);
  });

  it('batches a day with more keys than one jql string can hold', () => {
    const { transport, requests } = issuesTransport([]);
    const keys = Array.from({ length: 120 }, (_, index) => `FIP-${index}`);

    fetchJiraIssues$({ transport, credentials: CREDENTIALS, keys }).subscribe();

    expect(requests).toHaveLength(3);
  });

  it('drops a key jira does not know rather than failing the day', () => {
    const { transport } = issuesTransport([STORY]);
    const seen = vi.fn();

    fetchJiraIssues$({ transport, credentials: CREDENTIALS, keys: ['FIP-2177', 'FIP-9999'] }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0].map((issue: { key: string }) => issue.key)).toEqual(['FIP-2177']);
  });

  it('reads the subject field only when it is configured and holds a string', () => {
    const withSubject: JiraIssueResource = {
      ...STORY,
      fields: { ...STORY.fields, customfield_10050: ' user-management ', customfield_10051: { text: 'nope' } },
    };
    const seen = vi.fn();
    const other = vi.fn();

    fetchJiraIssues$({
      transport: issuesTransport([withSubject]).transport,
      credentials: CREDENTIALS,
      keys: ['FIP-2177'],
      subjectField: 'customfield_10050',
    }).subscribe(seen);
    fetchJiraIssues$({
      transport: issuesTransport([withSubject]).transport,
      credentials: CREDENTIALS,
      keys: ['FIP-2177'],
      subjectField: 'customfield_10051',
    }).subscribe(other);

    expect(seen.mock.calls[0]?.[0][0].subject).toBe('user-management');
    expect(other.mock.calls[0]?.[0][0].subject).toBeUndefined();
  });

  it('asks for the subject field only when one is configured', () => {
    const { transport, requests } = issuesTransport([STORY]);

    fetchJiraIssues$({
      transport,
      credentials: CREDENTIALS,
      keys: ['FIP-2177'],
      subjectField: 'customfield_10050',
    }).subscribe();

    expect(decodeURIComponent(requests[0]?.url ?? '')).toContain('customfield_10050');
  });
});

describe('fetchJiraIssueIds$', () => {
  it('maps every resolved key to the numeric id tempo needs', () => {
    const { transport } = issuesTransport([STORY, TASK]);
    const seen = vi.fn();

    fetchJiraIssueIds$({ transport, credentials: CREDENTIALS, keys: ['FIP-2177', 'FIP-2178'] }).subscribe(seen);

    expect([...(seen.mock.calls[0]?.[0] ?? [])]).toEqual([
      ['FIP-2177', '10101'],
      ['FIP-2178', '10102'],
    ]);
  });
});

const byIdTransport = (issues: JiraIssueResource[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);
      const wanted = decodeURIComponent(/jql=([^&]*)/.exec(request.url)?.[1] ?? '');

      return of({
        status: 200,
        headers: {},
        body: { issues: issues.filter((issue) => issue.id && wanted.includes(issue.id)) },
      }) as never;
    }),
  };

  return { transport, requests };
};

describe('fetchJiraIssueKeysByIds$', () => {
  it('maps the numeric ids on a tempo worklog back to keys', () => {
    const { transport, requests } = byIdTransport([STORY, TASK]);
    const seen = vi.fn();

    fetchJiraIssueKeysByIds$({ transport, credentials: CREDENTIALS, ids: ['10101', '10102'] }).subscribe(seen);

    expect(decodeURIComponent(requests[0]?.url ?? '')).toContain('id in (10101,10102)');
    expect([...(seen.mock.calls[0]?.[0] ?? [])]).toEqual([
      ['10101', 'FIP-2177'],
      ['10102', 'FIP-2178'],
    ]);
  });

  it('dedupes the ids and asks for nothing when there are none', () => {
    const { transport, requests } = byIdTransport([STORY]);
    const seen = vi.fn();

    fetchJiraIssueKeysByIds$({ transport, credentials: CREDENTIALS, ids: ['10101', ' 10101 '] }).subscribe();
    fetchJiraIssueKeysByIds$({ transport, credentials: CREDENTIALS, ids: [] }).subscribe(seen);

    expect(requests).toHaveLength(1);
    expect([...(seen.mock.calls[0]?.[0] ?? [])]).toEqual([]);
  });

  it('omits an id jira does not know rather than failing the day', () => {
    const { transport } = byIdTransport([STORY]);
    const seen = vi.fn();

    fetchJiraIssueKeysByIds$({ transport, credentials: CREDENTIALS, ids: ['10101', '99999'] }).subscribe(seen);

    expect([...(seen.mock.calls[0]?.[0] ?? [])]).toEqual([['10101', 'FIP-2177']]);
  });
});
