import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnyInfinityQueryConfig,
  createInfinityQueryConfig,
  def,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  V2QueryClient,
} from '../index';
import { Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config(); let items; let canLoadMore = canLoadMore">
      <span data-slot="items">{{ ids(items) }}</span>
      <span data-slot="canLoadMore">{{ canLoadMore }}</span>
      <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
    </div>
  `,
})
class PlainTriggerHost {
  config = input.required<AnyInfinityQueryConfig>();

  ids = (items: { id: string }[] | null) => (items ?? []).map((item) => item.id).join(',');
}

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config(); let items; let canLoadMore = canLoadMore">
      <span data-slot="items">{{ ids(items) }}</span>
      <span data-slot="canLoadMore">{{ canLoadMore }}</span>
      @if (canLoadMore) {
        <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
      }
    </div>
  `,
})
class GuardedTriggerHost {
  config = input.required<AnyInfinityQueryConfig>();

  ids = (items: { id: string }[] | null) => (items ?? []).map((item) => item.id).join(',');
}

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config(); let items">
      <span data-slot="items">{{ ids(items) }}</span>
      <et-infinity-query-trigger />
    </div>
  `,
})
class ObservedTriggerHost {
  config = input.required<AnyInfinityQueryConfig>();

  ids = (items: { id: string }[] | null) => (items ?? []).map((item) => item.id).join(',');
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  constructor(private callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    setTimeout(() =>
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }

  disconnect() {
    FakeIntersectionObserver.instances = FakeIntersectionObserver.instances.filter((o) => o !== this);
  }
}

const slotText = (fixture: { nativeElement: HTMLElement }, slot: string) =>
  (fixture.nativeElement.querySelector(`[data-slot="${slot}"]`)?.textContent ?? '').trim();

const withLegacyClient = (s: Scenario, body: (client: V2QueryClient) => void) => {
  const owner = s.consumer();
  const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));

  try {
    body(client);
  } finally {
    client._store.forEach((query, key) => {
      query.stopPolling();
      query.abort();
      client._store.remove(key);
    });

    client.clearAuthProvider();
    owner.destroy();
  }
};

const pagedUsers = (client: V2QueryClient) =>
  createInfinityQueryConfig({
    queryCreator: client.get({
      route: '/users',
      types: {
        args: def<{ queryParams: { page: number; limit: number } }>(),
        response: def<{ items: { id: string }[]; totalPages: number }>(),
      },
    }),
    limitParam: { value: 2 },
    response: { arrayType: [] as { id: string }[], valueExtractor: (response) => response.items },
  });

describe('legacy infinity query trigger scenario', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  const answerPages = (s: Scenario) =>
    s.api.on('GET', '/users', ({ query }) => {
      const page = Number(query['page'] ?? '1');

      return { body: { items: [{ id: `${page}a` }, { id: `${page}b` }], totalPages: 2 } };
    });

  describe('with an intersection observer', () => {
    beforeEach(() => vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver));
    afterEach(() => vi.unstubAllGlobals());

    it('keeps loading while the trigger stays visible after a page lands', () => {
      const s = scenario();
      s.api.on('GET', '/users', ({ query }) => {
        const page = Number(query['page'] ?? '1');

        return { body: { items: [{ id: `${page}a` }, { id: `${page}b` }], totalPages: 3 }, delay: 100 };
      });

      withLegacyClient(s, (client) => {
        const fixture = TestBed.createComponent(ObservedTriggerHost);

        fixture.componentRef.setInput('config', pagedUsers(client));
        fixture.detectChanges();

        for (let round = 0; round < 5; round++) {
          s.tick(100);
          fixture.detectChanges();
        }

        expect(slotText(fixture, 'items')).toBe('1a,1b,2a,2b,3a,3b');
        expect(s.api.requestCount('GET', '/users')).toBe(3);

        fixture.destroy();
        expect(FakeIntersectionObserver.instances).toHaveLength(0);
      });
    });
  });

  it('mounts a trigger that is a direct child of the infinity query template', () => {
    const s = scenario();
    answerPages(s);

    withLegacyClient(s, (client) => {
      const fixture = TestBed.createComponent(PlainTriggerHost);

      fixture.componentRef.setInput('config', pagedUsers(client));
      fixture.detectChanges();
      s.tick();
      fixture.detectChanges();

      expect(slotText(fixture, 'items')).toBe('1a,1b');

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="more"]')?.click();
      s.tick();
      fixture.detectChanges();

      expect(slotText(fixture, 'items')).toBe('1a,1b,2a,2b');

      fixture.destroy();
    });
  });

  it('mounts a trigger that only appears once the template can load more', () => {
    const s = scenario();
    answerPages(s);

    withLegacyClient(s, (client) => {
      const fixture = TestBed.createComponent(GuardedTriggerHost);

      fixture.componentRef.setInput('config', pagedUsers(client));
      fixture.detectChanges();
      s.tick();
      fixture.detectChanges();

      expect(slotText(fixture, 'canLoadMore')).toBe('true');

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="more"]')?.click();
      s.tick();
      fixture.detectChanges();

      expect(slotText(fixture, 'items')).toBe('1a,1b,2a,2b');

      fixture.destroy();
    });
  });
});
