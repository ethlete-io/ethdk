import { HttpErrorResponse } from '@angular/common/http';
import {
  AnyLegacyQuery,
  createLegacyQueryCreator,
  filterSuccess,
  provideLegacyPrepareFallback,
  QueryStateType,
  V2QueryState,
} from '../index';
import { describe, expect, it, vi } from 'vitest';
import { useScenario } from './harness';

type User = { id: string; name: string };
type GetUserArgs = { response: User; pathParams: { id: string } };

const recordStates = (query: AnyLegacyQuery) => {
  const states: V2QueryState[] = [];
  const subscription = query.state$.subscribe((state: V2QueryState) => states.push(state));

  return { states, stop: () => subscription.unsubscribe() };
};

describe('legacy interop scenario', () => {
  describe('createLegacyQueryCreator', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('wraps a current creator in the prepare/execute/state$ surface', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }));
      const recorded = recordStates(query);
      const responses: User[] = [];

      query.state$.pipe(filterSuccess()).subscribe((state) => responses.push(state.response));

      expect(query.rawState).toMatchObject({ type: QueryStateType.Prepared });

      query.execute();
      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(recorded.states.map((state) => state.type)).toEqual([
        QueryStateType.Prepared,
        QueryStateType.Loading,
        QueryStateType.Success,
      ]);
      expect(responses).toEqual([{ id: '1', name: 'Ada' }]);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      recorded.stop();
      c.destroy();
    });

    it('maps a failed request to a Failure state that carries the status', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ status: 500, body: { message: 'boom' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());
      s.flush();

      expect(query.rawState).toMatchObject({
        type: QueryStateType.Failure,
        error: { status: 500, detail: { message: 'boom' } },
      });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      c.destroy();
    });

    it('prepare() outside an injection context throws ET950 and names the creator', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      expect(() => legacyGetUser.prepare({ pathParams: { id: '1' } })).toThrow(/950/);
      expect(() => legacyGetUser.prepare({ pathParams: { id: '1' } })).toThrow(/"legacyGetUser"/);
      expect(() => legacyGetUser.createSignal(null)).toThrow(/950/);

      expect(s.api.requests.length).toBe(0);
    });

    it('prepare() with a destroyed injector warns once and returns an inert query that never executes', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const gone = s.consumer();
        const injector = gone.injector;
        gone.destroy();

        const query = legacyGetUser.prepare({ pathParams: { id: '1' }, injector });
        const recorded = recordStates(query);

        query.execute();
        s.tick();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]?.[0])).toContain('destroyed injector');
        expect(s.api.requests.length).toBe(0);
        expect(recorded.states.map((state) => state.type)).toEqual([QueryStateType.Prepared]);

        query.destroy();
        recorded.stop();
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('provideLegacyPrepareFallback', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: [provideLegacyPrepareFallback()],
    });

    it('lets prepare() outside an injection context run against the root injector', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const query = legacyGetUser.prepare({ pathParams: { id: '1' } }).execute();
      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      query.destroy();
    });
  });
});
