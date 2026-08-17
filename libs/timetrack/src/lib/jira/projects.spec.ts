import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { fetchJiraProjects$ } from './projects';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

type Page = { values: { key?: string; name?: string }[]; isLast?: boolean; startAt?: number };

const pagingTransport = (pages: Page[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({
        status: 200,
        headers: {},
        body: pages[requests.length - 1] ?? { values: [], isLast: true },
      }) as never;
    }),
  };

  return { transport, requests };
};

describe('fetchJiraProjects$', () => {
  it('asks for the most recently worked in project first', () => {
    const { transport, requests } = pagingTransport([{ values: [{ key: 'FIP', name: 'Fut Platform' }], isLast: true }]);
    const seen = vi.fn();

    fetchJiraProjects$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(requests[0]?.url).toContain('/rest/api/3/project/search');
    expect(requests[0]?.url).toContain('orderBy=-lastIssueUpdatedTime');
    expect(seen.mock.calls[0]?.[0]).toEqual([{ key: 'FIP', name: 'Fut Platform' }]);
  });

  it('names a project after its key when the instance sends no name', () => {
    const { transport } = pagingTransport([{ values: [{ key: 'FIP' }], isLast: true }]);
    const seen = vi.fn();

    fetchJiraProjects$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([{ key: 'FIP', name: 'FIP' }]);
  });

  it('drops a project the instance sends without a key, which nothing could file into', () => {
    const { transport } = pagingTransport([{ values: [{ name: 'No key' }, { key: 'FIP' }], isLast: true }]);
    const seen = vi.fn();

    fetchJiraProjects$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([{ key: 'FIP', name: 'FIP' }]);
  });

  it('pages by offset and concatenates every page', () => {
    const { transport, requests } = pagingTransport([
      { values: [{ key: 'A' }], isLast: false, startAt: 0 },
      { values: [{ key: 'B' }], isLast: true, startAt: 1 },
    ]);
    const seen = vi.fn();

    fetchJiraProjects$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(requests).toHaveLength(2);
    expect(requests[1]?.url).toContain('startAt=1');
    expect(seen.mock.calls[0]?.[0].map((project: { key: string }) => project.key)).toEqual(['A', 'B']);
  });

  it('stops on an empty page, so an instance that never reports the last one cannot loop', () => {
    const { transport, requests } = pagingTransport([
      { values: [{ key: 'A' }], isLast: false, startAt: 0 },
      { values: [], isLast: false, startAt: 1 },
    ]);

    fetchJiraProjects$({ transport, credentials: CREDENTIALS }).subscribe();

    expect(requests).toHaveLength(2);
  });

  it('stops at maxPages rather than paging forever', () => {
    const { transport, requests } = pagingTransport(
      Array.from({ length: 10 }, (_, index) => ({ values: [{ key: `P${index}` }], isLast: false, startAt: index })),
    );

    fetchJiraProjects$({ transport, credentials: CREDENTIALS, maxPages: 3 }).subscribe();

    expect(requests).toHaveLength(3);
  });
});
