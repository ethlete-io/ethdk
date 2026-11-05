import { InjectionToken } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { QueryStateType } from '../index';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClientCreator, useScenario } from './harness';

type GetUserArgs = { pathParams: { id: string } };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');

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
});
