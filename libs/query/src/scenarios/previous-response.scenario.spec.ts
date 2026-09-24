import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { createSecureGetQuery, withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

type Search = { response: { q: string }; queryParams: { q: string } };

const is500 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 500;

describe('previous response scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('keeps the previous response while each new args value loads, one request per change', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) => ({ body: { q: query['q'] }, delay: 1000 }));

    const search = s.get<Search>('/search');
    const term = signal('a');

    const c = s.consumer();
    const query = c.run(() => search(withArgs(() => ({ queryParams: { q: term() } }))));

    s.tick(1000);
    expect(query.response()).toEqual({ q: 'a' });

    term.set('b');
    s.tick(500);

    expect(query.response()).toEqual({ q: 'a' });
    expect(query.executionState()).toMatchObject({
      type: 'loading',
      hasCachedResponse: true,
      cachedResponse: { q: 'a' },
    });

    term.set('c');
    s.tick();

    expect(query.response()).toEqual({ q: 'a' });
    expect(query.executionState()?.type).toBe('loading');
    expect(s.api.requests.find((r) => r.query['q'] === 'b')?.aborted).toBe(true);

    s.tick(1000);
    expect(query.response()).toEqual({ q: 'c' });
    expect(query.executionState()).toEqual({ type: 'success', response: { q: 'c' } });

    term.set('d');
    s.tick();

    expect(query.executionState()).toMatchObject({
      type: 'loading',
      hasCachedResponse: true,
      cachedResponse: { q: 'c' },
    });

    s.tick(1000);
    expect(query.response()).toEqual({ q: 'd' });

    for (const q of ['a', 'b', 'c', 'd']) {
      expect(s.api.requests.filter((r) => r.query['q'] === q)).toHaveLength(1);
    }

    c.destroy();
  });

  it('reports a failure on new args with the previous response as cachedResponse', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) =>
      query['q'] === 'broken' ? { status: 500, body: { message: 'boom' } } : { body: { q: query['q'] } },
    );

    const search = s.get<Search>('/search');
    const term = signal('a');

    const c = s.consumer();
    const query = c.run(() => search(withArgs(() => ({ queryParams: { q: term() } }))));
    s.tick();

    term.set('broken');
    s.tick();

    expect(query.response()).toEqual({ q: 'a' });
    expect(query.executionState()).toMatchObject({
      type: 'failure',
      hasCachedResponse: true,
      cachedResponse: { q: 'a' },
    });
    expect(query.error()?.code).toBe(500);

    s.expectError(is500);
    c.destroy();
  });

  it('clears the previous response when the new args answer with an empty body', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) => (query['q'] === 'empty' ? { status: 204 } : { body: { q: query['q'] } }));

    const search = s.get<Search>('/search');
    const term = signal('a');

    const c = s.consumer();
    const query = c.run(() => search(withArgs(() => ({ queryParams: { q: term() } }))));
    s.tick();

    term.set('empty');
    s.tick();

    expect(query.response()).toBeNull();
    expect(query.executionState()).toEqual({ type: 'success', response: null });

    c.destroy();
  });

  it('parking the query clears the response and the execution state', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) => ({ body: { q: query['q'] } }));

    const search = s.get<Search>('/search');
    const term = signal<string | null>('a');

    const c = s.consumer();
    const query = c.run(() =>
      search(
        withArgs(() => {
          const q = term();

          return q === null ? null : { queryParams: { q } };
        }),
      ),
    );
    s.tick();
    expect(query.response()).toEqual({ q: 'a' });

    term.set(null);
    s.tick();

    expect(query.response()).toBeNull();
    expect(query.executionState()).toBeNull();

    term.set('b');
    s.tick();

    expect(query.response()).toEqual({ q: 'b' });
    expect(s.api.requestCount('GET', '/search')).toBe(2);

    c.destroy();
  });

  it('reset() clears the response', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) => ({ body: { q: query['q'] } }));

    const search = s.get<Search>('/search');

    const c = s.consumer();
    const query = c.run(() => search(withArgs(() => ({ queryParams: { q: 'a' } }))));
    s.tick();

    query.reset();

    expect(query.response()).toBeNull();
    expect(query.executionState()).toBeNull();

    c.destroy();
  });

  it('keepPreviousResponse: false clears the response as soon as the args change', () => {
    const s = scenario();
    s.api.on('GET', '/search', ({ query }) => ({ body: { q: query['q'] }, delay: 1000 }));

    const search = s.get<Search>('/search');
    const term = signal('a');

    const c = s.consumer();
    const query = c.run(() =>
      search(
        { keepPreviousResponse: false },
        withArgs(() => ({ queryParams: { q: term() } })),
      ),
    );
    s.tick(1000);

    term.set('b');
    s.tick();

    expect(query.response()).toBeNull();
    expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

    s.tick(1000);
    expect(query.response()).toEqual({ q: 'b' });

    c.destroy();
  });

  it('a mutation does not carry the previous response into its next execution', () => {
    const s = scenario();
    s.api.on('POST', '/notes', ({ body }) => ({ body, delay: 1000 }));

    const createNote = s.post<{ response: { text: string }; body: { text: string } }>('/notes');

    const c = s.consumer();
    const mutation = c.run(() => createNote());

    mutation.execute({ args: { body: { text: 'first' } } });
    s.tick(1000);
    expect(mutation.response()).toEqual({ text: 'first' });

    mutation.execute({ args: { body: { text: 'second' } } });
    s.tick();

    expect(mutation.response()).toBeNull();
    expect(mutation.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

    s.tick(1000);
    expect(mutation.response()).toEqual({ text: 'second' });

    c.destroy();
  });

  it('a logout clears a secure query that is loading new args with the previous response', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/search', ({ query }) => ({ body: { q: query['q'] }, delay: 1000 }));

    const search = createSecureGetQuery(s.clientRef, auth.ref)<Search>('/secure/search');
    const term = signal('a');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => search(withArgs(() => ({ queryParams: { q: term() } }))));
    s.tick(1000);
    expect(query.response()).toEqual({ q: 'a' });

    term.set('b');
    s.tick();
    expect(query.executionState()).toMatchObject({ type: 'loading', cachedResponse: { q: 'a' } });

    s.run(() => auth.logout());
    s.tick();

    expect(query.response()).toBeNull();
    expect(query.executionState()).toBeNull();

    s.tick(1000);
    await s.settle();

    expect(query.response()).toBeNull();

    c.destroy();
  });
});
