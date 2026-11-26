import { InjectionToken } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClientCreator, useScenario } from './harness';

type GetUserArgs = { pathParams: { id: string } };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');

describe.each(LEGACY_CLIENT_KINDS)('legacy prepare() with equal args on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('returns the same query for equal args', () => {
    const s = scenario();
    const legacy = createLegacyClient(s, kind);
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const c = s.consumer([{ provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) }]);
    const first = c.run(() => c.injector.get(GET_USER).prepare({ pathParams: { id: '1' } }));
    const second = c.run(() => c.injector.get(GET_USER).prepare({ pathParams: { id: '1' } }));

    expect(second).toBe(first);

    c.destroy();
    legacy.destroy();
  });
});
