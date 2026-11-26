import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { toQuerySignal } from '../index';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClientCreator, useScenario } from './harness';

type GetUserArgs = { pathParams: { id: string } };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');

describe.each(LEGACY_CLIENT_KINDS)('toQuerySignal on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('subscribes a cold source once', () => {
    const s = scenario();
    const legacy = createLegacyClient(s, kind);
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const c = s.consumer([{ provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) }]);
    let subscriptions = 0;

    const signal = c.run(() => {
      const creator = c.injector.get(GET_USER);
      const source = new Observable<ReturnType<typeof creator.prepare>>((subscriber) => {
        subscriptions++;
        subscriber.next(creator.prepare({ pathParams: { id: '1' } }));
      });

      return toQuerySignal(source);
    });

    expect(signal()).not.toBeNull();
    expect(subscriptions).toBe(1);

    c.destroy();
    legacy.destroy();
  });
});
