import { signal } from '@angular/core';
import { createGqlMutationViaPost, gql, withArgs, withLongPolling, withPolling } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('http scan 2026-09-27 scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  describe('execute({ args }) without withArgs', () => {
    it('records the args, and a bare execute() re-sends them', () => {
      const s = scenario();
      s.api.on('POST', '/notes', ({ body }) => ({ body: { saved: body } }));

      const createNote = s.post<{ response: { saved: unknown }; body: { text: string } }>('/notes');

      const c = s.consumer();
      const query = c.run(() => createNote());

      query.execute({ args: { body: { text: 'first' } } });

      const snapshot = query.createSnapshot();

      expect(query.args()).toEqual({ body: { text: 'first' } });

      s.tick();

      expect(snapshot.args()).toEqual({ body: { text: 'first' } });

      query.execute({ args: { body: { text: 'second' } } });
      s.tick();

      query.execute();
      s.tick();

      expect(s.api.httpRequests('POST', '/notes').map((request) => request.body)).toEqual([
        { text: 'first' },
        { text: 'second' },
        { text: 'second' },
      ]);
      expect(query.args()).toEqual({ body: { text: 'second' } });
      expect(query.response()).toEqual({ saved: { text: 'second' } });
    });

    it('records the args of a gql mutation, and a bare execute() re-sends them', () => {
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
      const query = c.run(() => renameUser());

      query.execute({ args: { variables: { name: 'Ada' } } });
      s.tick();

      expect(query.args()).toEqual({ variables: { name: 'Ada' } });

      query.execute();
      s.tick();

      const sent = s.api.httpRequests('POST', '/').map((request) => (request.body as { variables: unknown }).variables);

      expect(sent).toEqual([{ name: 'Ada' }, { name: 'Ada' }]);
    });

    it('lets withArgs keep owning args()', () => {
      const s = scenario();
      s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);
      const id = signal('1');

      const c = s.consumer();
      const query = c.run(() => getItem(withArgs(() => ({ pathParams: { id: id() } }))));
      s.tick();

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick();

        expect(query.args()).toEqual({ pathParams: { id: next } });
        expect(query.response()).toEqual({ id: next });
      }
    });

    it('keeps a long-polling chain running across its rounds', () => {
      const s = scenario();
      s.api.on('GET', '/feed', ({ query }) => ({ body: { cursor: Number(query['cursor'] ?? 0) + 1 } }));

      const getFeed = s.get<{ response: { cursor: number }; queryParams: { cursor?: number } }>('/feed');

      const c = s.consumer();
      const query = c.run(() =>
        getFeed(
          withLongPolling({
            delay: 100,
            nextArgs: (response) => ({ queryParams: { cursor: response?.cursor ?? 0 } }),
          }),
        ),
      );

      query.execute({ args: { queryParams: { cursor: 0 } } });
      s.tick();
      s.tick(101);
      s.tick(101);

      const rounds = s.api.requestCount('GET', '/feed');

      expect(rounds).toBeGreaterThanOrEqual(3);
      expect(query.response()?.cursor).toBeGreaterThanOrEqual(rounds - 1);

      c.destroy();
      s.tick();
    });
  });

  describe('refreshInUse executions', () => {
    it.each([
      { name: 'refreshQueriesInUse', refresh: (s: ReturnType<typeof scenario>) => s.client.refreshQueriesInUse() },
      { name: 'invalidateQueries', refresh: (s: ReturnType<typeof scenario>) => s.client.invalidateQueries() },
    ])('$name updates lastTimeExecutedAt() and resets triggeredBy()', ({ refresh }) => {
      const s = scenario();
      s.api.on('GET', '/scores', () => ({ body: { value: 1 } }));

      const getScores = s.get<{ response: { value: number } }>('/scores');

      const c = s.consumer();
      const query = c.run(() => getScores(withPolling({ interval: 1_000 })));
      s.tick();
      s.tick(1_000);

      expect(query.triggeredBy()).toBe('polling');
      const polledAt = query.lastTimeExecutedAt();

      s.tick(300);
      refresh(s);
      s.tick();

      expect(query.lastTimeExecutedAt()).toBeGreaterThan(polledAt ?? Infinity);
      expect(query.triggeredBy()).toBeNull();

      c.destroy();
      s.tick();
    });
  });

  describe('subtle.setResponse with transformResponse', () => {
    it('sets the response the consumer sees without transforming it again', () => {
      const s = scenario();
      s.api.on('GET', '/price', () => ({ body: { cents: 250 } }));

      const getPrice = s.get<{ response: { euros: number }; rawResponse: { cents: number } }>('/price', {
        transformResponse: (raw) => ({ euros: raw.cents / 100 }),
      });

      const c = s.consumer();
      const query = c.run(() => getPrice());
      s.tick();

      expect(query.response()).toEqual({ euros: 2.5 });

      query.subtle.setResponse({ euros: 7 });

      expect(query.response()).toEqual({ euros: 7 });
      expect(query.executionState()).toEqual({ type: 'success', response: { euros: 7 } });
      expect(query.error()).toBeNull();

      query.execute();
      s.tick();

      expect(query.response()).toEqual({ euros: 2.5 });
    });
  });
});
