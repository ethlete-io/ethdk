import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  createInfinityQueryConfig,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  withArgs,
  withPolling,
} from '../index';
import { Component, input } from '@angular/core';
import { AnyInfinityQueryConfig } from '../index';
import { createLegacyClient, LEGACY_CLIENT_KINDS, useScenario } from './harness';

const BASE_URL = 'https://api.test';

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config(); let items">
      <span>{{ items?.length }}</span>
      <et-infinity-query-trigger />
    </div>
  `,
})
class ObservedTriggerHost {
  config = input.required<AnyInfinityQueryConfig>();
}

describe('server platform scenario', () => {
  const scenario = useScenario({
    baseUrl: BASE_URL,
    clientOptions: { keepUnusedFor: 0 },
    providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
  });

  describe.each(LEGACY_CLIENT_KINDS)('infinity query trigger on the %s client', (kind) => {
    it('renders without creating an IntersectionObserver', () => {
      const s = scenario();
      s.api.on('GET', '/users', () => ({ body: { items: [{ id: 'a' }], totalPages: 2 } }));
      const created = vi.fn();

      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor() {
            created();
            throw new ReferenceError('IntersectionObserver is not defined');
          }
        },
      );

      const client = createLegacyClient(s, kind, { baseUrl: BASE_URL });

      try {
        const fixture = TestBed.createComponent(ObservedTriggerHost);

        fixture.componentRef.setInput(
          'config',
          createInfinityQueryConfig({
            queryCreator: client.get<{ queryParams: { page: number; limit: number } }>('/users') as never,
            limitParam: { value: 2 },
            response: {
              arrayType: [] as { id: string }[],
              valueExtractor: (response: { items: { id: string }[] }) => response.items,
            },
          }),
        );

        expect(() => fixture.detectChanges()).not.toThrow();
        expect(created).not.toHaveBeenCalled();
        fixture.destroy();
      } finally {
        client.destroy();
        vi.unstubAllGlobals();
      }
    });
  });

  it('withPolling executes once but arms no timer and no window or document listener', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);

    const c = s.consumer();
    const query = c.run(() =>
      getItem(
        withArgs(() => ({ pathParams: { id: '1' } })),
        withPolling({ interval: 1_000, pauseWhileHidden: true, refetchOnFocus: true, refetchOnReconnect: true }),
      ),
    );

    s.tick();
    expect(query.response()).toEqual({ id: '1' });
    expect(vi.getTimerCount()).toBe(0);

    s.tick(10_000);
    expect(s.api.requestCount('GET', '/items/1')).toBe(1);

    c.destroy();
  });
});
