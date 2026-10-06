import { signal } from '@angular/core';
import { createGqlMutationViaPost, createSecurePostQuery, gql, withArgs } from '../index';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { useScenario } from './harness';

type Note = { response: { saved: unknown }; body: { text: string } };

describe('query parked execute scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('a bare execute() on a parked static route sends nothing and warns', () => {
    const s = scenario();
    s.api.on('POST', '/notes', ({ body }) => ({ body: { saved: body } }));

    const createNote = s.post<Note>('/notes');
    const text = signal<string | null>(null);

    const c = s.consumer();
    const query = c.run(() => createNote(withArgs(() => (text() ? { body: { text: text() ?? '' } } : null))));
    s.tick();

    query.execute();
    s.tick();

    expect(s.api.requestCount('POST', '/notes')).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"/notes"');
    expect(String(warn.mock.calls[0]?.[0])).toContain('parked');

    query.execute({ args: { body: { text: 'explicit' } } });
    s.tick();

    expect(s.api.httpRequests('POST', '/notes').map((request) => request.body)).toEqual([{ text: 'explicit' }]);
  });

  it('a bare execute() on a parked function route does not throw', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);
    const id = signal<string | null>(null);

    const c = s.consumer();
    const query = c.run(() => getItem(withArgs(() => (id() ? { pathParams: { id: id() ?? '' } } : null))));
    s.tick();

    expect(() => query.execute()).not.toThrow();
    s.tick();

    expect(s.api.requestCount('GET', '/items/:id')).toBe(0);
    expect(String(warn.mock.calls[0]?.[0])).toContain('function route');

    id.set('7');
    s.tick();

    expect(query.response()).toEqual({ id: '7' });
  });

  it('a bare execute() on a parked gql mutation sends nothing and warns', () => {
    const s = scenario();
    s.api.on('POST', '/', () => ({ body: { data: { renameUser: { ok: true } } } }));

    const renameUser = createGqlMutationViaPost(s.clientRef)<{
      response: { renameUser: { ok: boolean } };
      variables: { name: string };
    }>(gql`
      mutation RenameUser($name: String!) {
        renameUser(name: $name) {
          ok
        }
      }
    `);

    const c = s.consumer();
    const query = c.run(() => renameUser(withArgs(() => null)));
    s.tick();

    query.execute();
    s.tick();

    expect(s.api.requestCount('POST', '/')).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a bare execute() on a parked secure query sends nothing and warns', async () => {
    const s = scenario();
    const auth = s.auth({ accessTokenExpiresInMs: 20000 });

    s.api.protect('/secure/**');
    s.api.on('POST', '/secure/notes', ({ body }) => ({ body: { saved: body } }));

    const createNote = createSecurePostQuery(s.clientRef, auth.ref)<Note>('/secure/notes');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => createNote(withArgs(() => null)));
    s.tick();

    query.execute();
    await s.settle();

    expect(s.api.requestCount('POST', '/secure/notes')).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"/secure/notes"');
  });
});
