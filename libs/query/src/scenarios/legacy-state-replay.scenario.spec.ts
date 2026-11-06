import { InjectionToken } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { take } from 'rxjs';
import { filterSuccess, QueryStateType } from '../index';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClientCreator, sequence, useScenario } from './harness';

type GetUserArgs = { pathParams: { id: string } };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');
const GET_ITEMS = new InjectionToken<LegacyClientCreator<object>>('GET_ITEMS');

describe.each(LEGACY_CLIENT_KINDS)('legacy state$ after execute() on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('does not replay the previous Success to a subscriber that attaches right after execute()', () => {
    const s = scenario();
    const legacy = createLegacyClient(s, kind);
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer([{ provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) }]);
    const query = c.run(() => c.injector.get(GET_USER).prepare({ pathParams: { id: '1' } }));

    const first: QueryStateType[] = [];
    const keepAlive = query.state$.subscribe((state) => first.push(state.type));

    query.execute();
    s.tick(500);
    expect(first.at(-1)).toBe(QueryStateType.Success);

    query.execute({ skipCache: true });

    const late: QueryStateType[] = [];
    const lateSubscription = query.state$.subscribe((state) => late.push(state.type));

    expect(late[0]).toBe(QueryStateType.Loading);

    s.tick(500);
    expect(late.at(-1)).toBe(QueryStateType.Success);

    lateSubscription.unsubscribe();
    keepAlive.unsubscribe();
    c.destroy();
    legacy.destroy();
  });
  it('keeps the previous Success from every subscriber until the refresh responds', () => {
    const s = scenario();
    const legacy = createLegacyClient(s, kind);
    s.api.on(
      'GET',
      '/items',
      sequence([
        { body: { id: 'a', name: 'Before' }, delay: 100 },
        { body: { id: 'a', name: 'After' }, delay: 100 },
      ]),
    );

    const c = s.consumer([{ provide: GET_ITEMS, useValue: legacy.get<object>('/items') }]);
    const query = c.run(() => c.injector.get(GET_ITEMS).prepare({}));

    const live: { type: QueryStateType; response?: unknown }[] = [];
    const keepAlive = query.state$.subscribe((state) =>
      live.push({ type: state.type, response: 'response' in state ? state.response : undefined }),
    );
    query.execute();
    s.tick(500);
    expect(live.at(-1)).toEqual({ type: QueryStateType.Success, response: { id: 'a', name: 'Before' } });

    const liveBeforeRefresh = live.length;
    query.execute({ skipCache: true });

    const late: QueryStateType[] = [];
    const lateSubscription = query.state$.subscribe((state) => late.push(state.type));
    const responses: unknown[] = [];
    const successSubscription = query.state$
      .pipe(filterSuccess(), take(1))
      .subscribe((state) => responses.push(state.response));

    expect(late).toEqual([QueryStateType.Loading]);
    expect(responses).toEqual([]);

    s.tick(50);
    expect(late).toEqual([QueryStateType.Loading]);
    expect(responses).toEqual([]);
    expect(live.slice(liveBeforeRefresh).map((state) => state.type)).not.toContain(QueryStateType.Success);

    s.tick(500);
    expect(late.at(-1)).toBe(QueryStateType.Success);
    expect(late.filter((type) => type === QueryStateType.Success)).toHaveLength(1);
    expect(responses).toEqual([{ id: 'a', name: 'After' }]);
    expect(live.slice(liveBeforeRefresh).filter((state) => state.type === QueryStateType.Success)).toEqual([
      { type: QueryStateType.Success, response: { id: 'a', name: 'After' } },
    ]);

    successSubscription.unsubscribe();
    lateSubscription.unsubscribe();
    keepAlive.unsubscribe();
    c.destroy();
    legacy.destroy();
  });
});

describe('ET800 on the interop client', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('throws ET800 naming the query when execute({ skipCache: true }) repeats in a tight loop', () => {
    const s = scenario();
    const legacy = createLegacyClient(s, 'interop');
    s.api.on('GET', '/me', () => ({ body: { id: 'me' } }));

    const c = s.consumer([{ provide: GET_ITEMS, useValue: legacy.get<object>('/me') }]);
    const query = c.run(() => c.injector.get(GET_ITEMS).prepare({}));

    expect(() => {
      for (let i = 0; i < 5; i++) {
        query.execute({ skipCache: true });
        s.tick(1);
      }
    }).not.toThrow();
    expect(() => query.execute({ skipCache: true })).toThrow(
      /The query for "\/me" .*execute\(\{ skipCache: true \}\) calls count/,
    );

    c.destroy();
    legacy.destroy();
  });
});
