import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { searchJiraIssues$ } from './search';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const pagingTransport = (pages: { issues: { key: string }[]; nextPageToken?: string }[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: pages[requests.length - 1] ?? { issues: [] } }) as never;
    }),
  };

  return { transport, requests };
};

const search$ = (transport: TimetrackTransport, options?: { maxPages?: number }) =>
  searchJiraIssues$({
    transport,
    credentials: CREDENTIALS,
    jql: 'key in (FIP-1)',
    fields: ['summary', 'updated'],
    describe: 'issues',
    options,
  });

describe('searchJiraIssues$', () => {
  it('names the fields explicitly, as the jql endpoint requires', () => {
    const { transport, requests } = pagingTransport([{ issues: [{ key: 'FIP-1' }] }]);

    search$(transport).subscribe();

    expect(requests[0]?.url).toContain('/rest/api/3/search/jql');
    expect(requests[0]?.url).toContain('fields=summary%2Cupdated');
  });

  it('follows the cursor and concatenates every page', () => {
    const { transport, requests } = pagingTransport([
      { issues: [{ key: 'FIP-1' }], nextPageToken: 'p2' },
      { issues: [{ key: 'FIP-2' }], nextPageToken: 'p3' },
      { issues: [{ key: 'FIP-3' }] },
    ]);
    const seen = vi.fn();

    search$(transport).subscribe(seen);

    expect(requests).toHaveLength(3);
    expect(requests[1]?.url).toContain('nextPageToken=p2');
    expect(seen.mock.calls[0]?.[0].map((issue: { key: string }) => issue.key)).toEqual(['FIP-1', 'FIP-2', 'FIP-3']);
  });

  it('stops at maxPages rather than paging a runaway query forever', () => {
    const { transport, requests } = pagingTransport(
      Array.from({ length: 10 }, (_, index) => ({ issues: [{ key: `FIP-${index}` }], nextPageToken: 'more' })),
    );

    search$(transport, { maxPages: 3 }).subscribe();

    expect(requests).toHaveLength(3);
  });

  it('emits once, after the last page', () => {
    const { transport } = pagingTransport([{ issues: [{ key: 'FIP-1' }], nextPageToken: 'p2' }, { issues: [] }]);
    const seen = vi.fn();

    search$(transport).subscribe(seen);

    expect(seen).toHaveBeenCalledTimes(1);
  });
});
