import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Paginated } from '@ethlete/types';
import { createPagedQueryStack, ethletePaginationAdapter, withArgs, withPolling } from '../index';
import { describe, expect, it } from 'vitest';
import { sequence, useScenario } from './harness';

type ItemArgs = { response: { id: string }; pathParams: { id: string } };

const ethletePage = (page: number, totalPageCount: number) => ({
  items: [{ id: page }],
  currentPage: page,
  nextPage: page < totalPageCount ? page + 1 : null,
  totalPageCount,
  itemsPerPage: 1,
  totalHits: totalPageCount,
});

describe('races scenario: args and aborts', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('lands only the latest args when they flip back and forth while each request is in flight', () => {
    const s = scenario();
    s.api.on('GET', '/race-items/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 300 }));

    const getItem = s.get<ItemArgs>((p) => `/race-items/${p.id}`);
    const id = signal('a');
    const seen: (string | undefined)[] = [];

    const c = s.consumer();
    const query = c.run(() => getItem(withArgs(() => ({ pathParams: { id: id() } }))));

    s.tick(100);
    id.set('b');
    s.tick(100);
    id.set('a');
    s.tick(100);
    id.set('c');
    s.tick(100);
    seen.push(query.response()?.id);

    s.tick(150);
    seen.push(query.response()?.id);
    s.tick(100);
    seen.push(query.response()?.id);

    expect(s.api.requests.map((r) => r.path)).toEqual([
      '/race-items/a',
      '/race-items/b',
      '/race-items/a',
      '/race-items/c',
    ]);
    expect(seen).toEqual([undefined, undefined, 'c']);
    expect(query.loading()).toBeNull();
    expect(query.args()).toEqual({ pathParams: { id: 'c' } });

    c.destroy();
  });

  it('never lands the aborted response after an abort and an immediate re-execute', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/race-abort',
      sequence([
        { body: { v: 1 }, delay: 200 },
        { body: { v: 2 }, delay: 500 },
      ]),
    );

    const getEntry = s.get<{ response: { v: number } }>('/race-abort');
    const c = s.consumer();
    const query = c.run(() => getEntry());

    s.tick(50);
    expect(query.abort()).toBe(true);
    query.execute();

    s.tick(300);
    expect(query.response()).toBeNull();
    expect(query.loading()).not.toBeNull();

    s.tick(300);
    expect(query.response()).toEqual({ v: 2 });
    expect(query.loading()).toBeNull();
    expect(s.api.requestCount('GET', '/race-abort')).toBe(2);

    c.destroy();
  });

  it('stops loading on every consumer of a shared entry when one of them aborts, and either can execute again', () => {
    const s = scenario();
    s.api.on('GET', '/race-shared', sequence([{ body: { v: 1 }, delay: 500 }, { body: { v: 2 } }]));

    const getEntry = s.get<{ response: { v: number } }>('/race-shared');
    const a = s.consumer();
    const b = s.consumer();
    const qa = a.run(() => getEntry());
    const qb = b.run(() => getEntry());

    s.tick(50);
    qa.abort();
    s.tick(1);
    expect(qa.loading()).toBeNull();
    expect(qb.loading()).toBeNull();

    qb.execute();
    s.tick();
    expect(qa.response()).toEqual({ v: 2 });
    expect(qb.response()).toEqual({ v: 2 });
    expect(s.api.requestCount('GET', '/race-shared')).toBe(2);

    a.destroy();
    b.destroy();
  });
});

describe('races scenario: retention', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 5_000 } });

  it('evicts at the end of the window and a consumer mounting on that instant fetches cold', () => {
    const s = scenario();
    s.api.on('GET', '/race-evict', sequence([{ body: { n: 1 } }, { body: { n: 2 }, delay: 100 }]));

    const getEntry = s.get<{ response: { n: number } }>('/race-evict');
    const a = s.consumer();
    a.run(() => getEntry());
    s.tick();
    a.destroy();

    s.tick(5_000);
    s.tick(1);
    expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);

    const b = s.consumer();
    const query = b.run(() => getEntry());
    expect(query.response()).toBeNull();

    s.tick(100);
    expect(query.response()).toEqual({ n: 2 });

    b.destroy();
    s.tick(5_001);
    expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
  });

  it('keeps the held response when the last consumer leaves mid-refresh and renders it to the next one', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/race-refresh',
      sequence([{ body: { n: 1 } }, { body: { n: 2 }, delay: 500 }, { body: { n: 3 }, delay: 100 }]),
    );

    const getEntry = s.get<{ response: { n: number } }>('/race-refresh');
    const a = s.consumer();
    const first = a.run(() => getEntry());
    s.tick();
    first.execute();
    s.tick(100);
    a.destroy();

    s.tick(100);
    const b = s.consumer();
    const second = b.run(() => getEntry());
    expect(second.response()).toEqual({ n: 1 });

    s.tick(600);
    expect(second.response()).toEqual({ n: 3 });
    expect(second.loading()).toBeNull();

    b.destroy();
    s.tick(5_001);
    expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
  });
});

describe('races scenario: polling and manual execution', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('lands the newest response when a poll tick falls due while a manual execute is in flight', () => {
    const s = scenario();
    let n = 0;
    s.api.on('GET', '/race-poll', () => ({ body: { n: ++n }, delay: 300 }));

    const getFeed = s.get<{ response: { n: number } }>('/race-poll');
    const c = s.consumer();
    const query = c.run(() => getFeed(withPolling({ interval: 1_000 })));

    s.tick(300);
    expect(query.response()).toEqual({ n: 1 });

    s.tick(500);
    query.execute();
    s.tick(400);

    s.tick(400);
    expect(query.loading()).toBeNull();
    expect(query.response()).toEqual({ n: s.api.requestCount('GET', '/race-poll') });

    const sent = s.api.requestCount('GET', '/race-poll');
    c.destroy();
    s.tick(5_000);
    expect(s.api.requestCount('GET', '/race-poll')).toBe(sent);
  });
});

describe('races scenario: pagination', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('keeps the loaded items and the failed page retryable when an appended page fails', () => {
    const s = scenario();
    let failPage2 = true;
    s.api.on('GET', '/race-pages', ({ query }) =>
      query['page'] === '2' && failPage2
        ? { status: 500, body: { message: 'boom' } }
        : { body: ethletePage(Number(query['page']), 3) },
    );

    const getPage = s.get<{ response: Paginated<{ id: number }>; queryParams: { page: number } }>('/race-pages');
    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPage,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick();
    pages.fetchNextPage();
    s.tick();

    expect(pages.error()?.code).toBe(500);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    expect(pages.items()).toEqual([{ id: 1 }]);
    expect(pages.loading()).toBe(false);

    failPage2 = false;
    pages.execute();
    s.tick();

    expect(pages.error()).toBeNull();
    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }]);

    pages.fetchNextPage();
    s.tick();
    expect(pages.items()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(pages.isLastPageLoaded()).toBe(true);

    c.destroy();
  });
});
