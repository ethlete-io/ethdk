import { AfterContentInit, Component, ComponentRef, inject, InjectionToken, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  AnyInfinityQueryConfig,
  createInfinityQueryConfig,
  def,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  injectInfinityQueryResponseDelay,
  provideInfinityQueryResponseDelay,
  skipPaginationPageParamCalculator,
} from '../index';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClient, Scenario, useScenario } from './harness';

type News = { id: string };
type NewsPage = { items: News[]; total: number };
type NewsArgs = { queryParams: { skip: number; limit: number } };

const NEWS_CONFIG = new InjectionToken<AnyInfinityQueryConfig>('NEWS_CONFIG');

@Component({ selector: 'app-masonry', template: '<ng-content />' })
class MasonryComponent implements AfterContentInit, OnDestroy {
  private readonly infinityQueryResponseDelay = injectInfinityQueryResponseDelay({ optional: true });
  private layout = Subscription.EMPTY;

  ngAfterContentInit() {
    this.infinityQueryResponseDelay?.enabled.set(true);

    this.layout = timer(100).subscribe(() => this.infinityQueryResponseDelay?.enabled.set(false));
  }

  ngOnDestroy() {
    this.layout.unsubscribe();
  }
}

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config; let items; let loading = loading; let canLoadMore = canLoadMore">
      <span data-slot="items">{{ ids(items) }}</span>
      <span data-slot="loading">{{ loading }}</span>
      <span data-slot="canLoadMore">{{ canLoadMore }}</span>
      <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
    </div>
  `,
})
class NewsListHost {
  readonly config = inject(NEWS_CONFIG);

  ids = (items: News[] | null) => (items ?? []).map((item) => item.id).join(',');
}

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective, MasonryComponent],
  template: `
    <div *etInfinityQuery="config; let items; let loading = loading">
      <app-masonry>
        <span data-slot="items">{{ ids(items) }}</span>
      </app-masonry>
      <span data-slot="loading">{{ loading }}</span>
      <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
    </div>
  `,
})
class MasonryNewsHost {
  readonly config = inject(NEWS_CONFIG);

  ids = (items: News[] | null) => (items ?? []).map((item) => item.id).join(',');
}

const slot = (ref: ComponentRef<unknown>, name: string) =>
  ((ref.location.nativeElement as HTMLElement).querySelector(`[data-slot="${name}"]`)?.textContent ?? '').trim();

const clickMore = (ref: ComponentRef<unknown>) =>
  (ref.location.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="more"]')?.click();

const serveNews = (s: Scenario, total: number, delay = 50) =>
  s.api.on('GET', '/news', ({ query }) => {
    const skip = Number(query['skip']);
    const limit = Number(query['limit']);
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - skip)) }, (_, i) => ({
      id: `n${skip + i}`,
    }));

    return { body: { items, total } satisfies NewsPage, delay };
  });

const newsConfig = (legacy: LegacyClient) =>
  createInfinityQueryConfig({
    queryCreator: legacy.get<NewsArgs>('/news') as never,
    defaultArgs: { queryParams: { skip: 0, limit: 1 } } as never,
    pageParam: { key: 'skip', valueCalculator: skipPaginationPageParamCalculator },
    limitParam: { key: 'limit', value: 2 },
    response: {
      arrayType: def<News[]>(),
      valueExtractor: (response: NewsPage) => response.items,
      totalPagesExtractor: ({ response, itemsPerPage }: { response: NewsPage; itemsPerPage: number }) =>
        Math.ceil(response.total / itemsPerPage),
    },
  });

describe.each(LEGACY_CLIENT_KINDS)('legacy infinity patterns on the %s client', (kind) => {
  describe('skipPaginationPageParamCalculator as the page param', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends skip as an item offset per page and stops at the last page', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      serveNews(s, 7);

      expect(skipPaginationPageParamCalculator({ page: 1, itemsPerPage: 20 })).toBe(0);
      expect(skipPaginationPageParamCalculator({ page: 3, itemsPerPage: 20 })).toBe(40);

      const c = s.consumer([{ provide: NEWS_CONFIG, useValue: newsConfig(legacy) }]);
      const ref = s.mount(NewsListHost, c.injector);

      s.tick(1000);
      expect(slot(ref, 'items')).toBe('n0,n1');

      for (const expected of ['n0,n1,n2,n3', 'n0,n1,n2,n3,n4,n5', 'n0,n1,n2,n3,n4,n5,n6']) {
        clickMore(ref);
        s.tick(10);
        expect(slot(ref, 'loading')).toBe('true');

        s.tick(1000);
        expect(slot(ref, 'items')).toBe(expected);
      }

      expect(slot(ref, 'canLoadMore')).toBe('false');

      clickMore(ref);
      s.tick(1000);
      s.expectError(/already at the end/);

      expect(s.api.requests.map((request) => `${request.query['skip']}/${request.query['limit']}`)).toEqual([
        '0/2',
        '2/2',
        '4/2',
        '6/2',
      ]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('a masonry child holding the response through injectInfinityQueryResponseDelay', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps loading until the child releases the delay, then renders the page', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      serveNews(s, 6, 20);

      const c = s.consumer([{ provide: NEWS_CONFIG, useValue: newsConfig(legacy) }]);
      const ref = s.mount(MasonryNewsHost, c.injector);

      s.tick(50);
      expect(s.api.requestCount('GET', '/news')).toBe(1);
      expect(slot(ref, 'loading')).toBe('true');
      expect(slot(ref, 'items')).toBe('');

      s.tick(100);
      expect(slot(ref, 'loading')).toBe('false');
      expect(slot(ref, 'items')).toBe('n0,n1');

      clickMore(ref);
      s.tick(1000);
      expect(slot(ref, 'items')).toBe('n0,n1,n2,n3');
      expect(s.api.requestCount('GET', '/news')).toBe(2);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('scopes the delay to one directive instance', () => {
      const s = scenario();
      const a = s.consumer([provideInfinityQueryResponseDelay()]);
      const b = s.consumer([provideInfinityQueryResponseDelay()]);
      const delayA = a.run(() => injectInfinityQueryResponseDelay());
      const delayB = b.run(() => injectInfinityQueryResponseDelay());

      delayA.enabled.set(true);

      expect(delayA.enabled()).toBe(true);
      expect(delayB.enabled()).toBe(false);
      expect(s.run(() => injectInfinityQueryResponseDelay({ optional: true }))).toBeNull();

      a.destroy();
      b.destroy();
    });
  });
});
