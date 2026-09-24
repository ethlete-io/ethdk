import { signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  addQueryContainerHandling,
  AnyLegacyQuery,
  effectComputed,
  queryArrayComputed,
  queryComputedTillTruthy,
  queryStateSignal,
  QueryStateType,
  toQuerySubject,
} from '../index';
import { describe, expect, it } from 'vitest';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClientQuery, useScenario } from './harness';

type GetUserArgs = { pathParams: { id: string } };

describe.each(LEGACY_CLIENT_KINDS)('legacy signal helpers on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const setup = () => {
    const s = scenario();
    const legacy = createLegacyClient(s, kind);
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

    const getUser = legacy.get<GetUserArgs>((p) => `/users/${p.id}`);
    const c = s.consumer();

    return { s, legacy, getUser, c };
  };

  const responseIds = (queries: readonly LegacyClientQuery[] | null) =>
    queries?.map((query) => (query.rawState as { response?: { id: string } }).response?.id);

  describe('queryArrayComputed', () => {
    it('sends one GET per added item, aborts removed ones and keeps the current array live', () => {
      const { s, legacy, getUser, c } = setup();
      const ids = signal(['1', '2']);

      const queries = c.run(() =>
        queryArrayComputed(
          () => ids().map((id) => getUser.prepare({ pathParams: { id } }).execute()) as AnyLegacyQuery[],
        ),
      );

      s.tick(10);

      for (const next of [['1', '2', '3'], ['1', '4'], ['5']]) {
        ids.set(next);
        s.tick(10);

        expect(legacy.liveQueries()).toHaveLength(next.length);
        expect(legacy.liveQueries()).toEqual(expect.arrayContaining<LegacyClientQuery>(queries() ?? []));
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4', '5']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      const aborted = s.api.requests.filter((request) => request.aborted).map((request) => request.path);
      expect(aborted.sort()).toEqual(['/users/1', '/users/2', '/users/3', '/users/4']);
      expect(responseIds(queries())).toEqual(['5']);

      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);
      legacy.destroy();
    });

    it('drops every query when the array empties and rebuilds it on the next item', () => {
      const { s, legacy, getUser, c } = setup();
      const ids = signal<string[]>([]);

      const queries = c.run(() =>
        queryArrayComputed(
          () => ids().map((id) => getUser.prepare({ pathParams: { id } }).execute()) as AnyLegacyQuery[],
        ),
      );

      for (const next of [['1', '2'], [], ['3']]) {
        ids.set(next);
        s.tick(1000);

        expect(legacy.liveQueries()).toHaveLength(next.length);
        expect(responseIds(queries())).toEqual(next);
      }

      expect(s.api.requests.map((request) => request.path)).toEqual(['/users/1', '/users/2', '/users/3']);

      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);
      legacy.destroy();
    });
  });

  describe('queryComputedTillTruthy', () => {
    it('stops reacting once the first query exists and keeps that one live', () => {
      const { s, legacy, getUser, c } = setup();
      const id = signal<string | null>(null);

      const query = c.run(() =>
        queryComputedTillTruthy(() => {
          const current = id();

          return current ? getUser.prepare({ pathParams: { id: current } }).execute() : null;
        }),
      );

      s.tick(10);
      expect(query()).toBeNull();

      for (const next of ['1', '2', '3']) {
        id.set(next);
        s.tick(10);

        expect(legacy.liveQueries()).toEqual([query()]);
      }

      s.tick(1000);

      expect(s.api.requests.map((request) => request.path)).toEqual(['/users/1']);
      expect(query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1' } });

      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);
      legacy.destroy();
    });
  });

  describe('toQuerySubject', () => {
    it('sends one GET per set query, aborts the superseded one and emits each', () => {
      const { s, legacy, getUser, c } = setup();
      const current = signal<LegacyClientQuery | null>(null);
      const emitted: (LegacyClientQuery | null)[] = [];

      c.run(() => toQuerySubject(current)).subscribe((query) => emitted.push(query));

      for (const id of ['1', '2', '3', '4']) {
        current.set(c.run(() => getUser.prepare({ pathParams: { id } }).execute()));
        s.tick(10);

        expect(legacy.liveQueries()).toEqual([current()]);
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);
      expect(emitted.filter(Boolean)).toEqual(legacy.prepared());

      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);
      legacy.destroy();
    });
  });

  describe('effectComputed with addQueryContainerHandling', () => {
    it('sends one GET per args change and aborts the superseded one', () => {
      const { s, legacy, getUser, c } = setup();
      const id = signal('1');

      const query = effectComputed(() => getUser.prepare({ pathParams: { id: id() } }).execute(), c.injector);
      c.run(() => addQueryContainerHandling(toObservable(query), () => query()));

      s.tick(10);

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);

        expect(legacy.liveQueries()).toEqual([query()]);
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);

      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);
      legacy.destroy();
    });
  });

  describe('queryStateSignal', () => {
    it('follows the state of the query a signal currently holds', () => {
      const { s, legacy, getUser, c } = setup();
      const current = signal<LegacyClientQuery | null>(null);
      const state = c.run(() => queryStateSignal(current));

      for (const id of ['1', '2', '3']) {
        current.set(c.run(() => getUser.prepare({ pathParams: { id } }).execute()));
        s.tick(10);
        expect(state()?.type).toBe(QueryStateType.Loading);

        s.tick(1000);
        expect(state()).toMatchObject({ type: QueryStateType.Success, response: { id } });
      }

      c.destroy();
      for (const query of legacy.prepared()) query.abort();
      legacy.destroy();
    });
  });
});
