import { Component, ComponentRef, inject, InjectionToken, Injector, signal, WritableSignal } from '@angular/core';
import { Paginated } from '@ethlete/types';
import {
  createPagedQueryStack,
  createQueryBatch,
  createQueryCollectionSignal,
  ethletePaginationAdapter,
  QueryDirective,
} from '../index';
import { describe, expect, it } from 'vitest';
import {
  createLegacyClient,
  LEGACY_CLIENT_KINDS,
  LegacyClientCreator,
  LegacyClientKind,
  LegacyClientQuery,
  useScenario,
} from './harness';

type ClaimArgs = { pathParams: { id: string } };
type ClaimCollection = { type: 'accept' | 'decline'; query: LegacyClientQuery };

const ACCEPT_CLAIM = new InjectionToken<LegacyClientCreator<ClaimArgs>>('ACCEPT_CLAIM');
const DECLINE_CLAIM = new InjectionToken<LegacyClientCreator<ClaimArgs>>('DECLINE_CLAIM');
const CLIENT_KIND = new InjectionToken<LegacyClientKind>('CLIENT_KIND');

@Component({
  imports: [QueryDirective],
  template: `
    <ng-container *etQuery="claim(); scope as scope">
      <span data-slot="scope">{{ scope ?? '-' }}</span>
    </ng-container>
  `,
})
class ClaimScopeHost {
  private readonly acceptClaim = inject(ACCEPT_CLAIM);
  private readonly declineClaim = inject(DECLINE_CLAIM);
  private readonly injector = inject(CLIENT_KIND) === 'interop' ? inject(Injector) : undefined;

  readonly claim = createQueryCollectionSignal({
    accept: this.acceptClaim as never,
    decline: this.declineClaim as never,
  }) as unknown as WritableSignal<ClaimCollection | null>;

  run(type: ClaimCollection['type'], id: string) {
    const creator = type === 'accept' ? this.acceptClaim : this.declineClaim;

    this.claim.set({
      type,
      query: creator.prepare({ pathParams: { id }, ...(this.injector && { injector: this.injector }) }).execute(),
    });
  }
}

const slot = (ref: ComponentRef<unknown>, name: string) =>
  ((ref.location.nativeElement as HTMLElement).querySelector(`[data-slot="${name}"]`)?.textContent ?? '').trim();

describe('http scan 2026-10-03 scenario', () => {
  describe('a cache-control with both max-age and s-maxage', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('takes the freshness window from max-age, whichever comes first', () => {
      const s = scenario();
      s.api.on('GET', '/feed', () => ({
        body: { n: 1 },
        headers: { 'cache-control': 'public, s-maxage=600, max-age=20' },
      }));

      const getFeed = s.get<{ response: { n: number } }>('/feed');

      const c = s.consumer();
      const query = c.run(() => getFeed());
      s.tick();

      s.tick(9_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/feed')).toBe(1);

      s.tick(1_001);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/feed')).toBe(2);

      c.destroy();
    });
  });

  describe('a cacheAdapter that answers NaN', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0, cacheAdapter: (headers) => parseInt(headers.get('x-ttl') ?? '') },
    });

    it('treats the response as having no freshness window instead of fresh forever', () => {
      const s = scenario();
      s.api.on('GET', '/nan-ttl', () => ({ body: { n: 1 } }));

      const getNanTtl = s.get<{ response: { n: number } }>('/nan-ttl');

      const c = s.consumer();
      const query = c.run(() => getNanTtl());
      s.tick();

      s.tick(1_000);
      query.execute({ options: { allowCache: true } });
      s.tick();
      expect(s.api.requestCount('GET', '/nan-ttl')).toBe(2);

      c.destroy();
    });
  });

  describe('a query batch with concurrency NaN', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('falls back to the default concurrency instead of never sending a request', () => {
      const s = scenario();
      s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

      const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);

      const c = s.consumer();
      const batch = c.run(() =>
        createQueryBatch({
          queryCreator: patchPost,
          concurrency: Number('not a number'),
          args: (id: string) => ({ pathParams: { id } }),
        }),
      );

      let ok: boolean | undefined;
      batch.run(['1', '2', '3', '4', '5']).subscribe((result) => (ok = result.ok));
      s.tick();

      expect(s.api.pending().length).toBe(4);

      s.flush();

      expect(ok).toBe(true);
      expect(batch.status()).toBe('success');

      c.destroy();
    });
  });

  describe('a paged query stack reloaded by its args', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('reports direction next again after a backward fetch', () => {
      const s = scenario();
      s.api.on('GET', '/ranked', ({ query }) => ({
        body: {
          items: [{ id: `${query['tag']}-${query['page']}` }],
          currentPage: Number(query['page']),
          nextPage: Number(query['page']) + 1,
          totalPageCount: 5,
          itemsPerPage: 1,
          totalHits: 5,
        },
      }));

      const getRanked = s.get<{ response: Paginated<{ id: string }>; queryParams: { page: number; tag: string } }>(
        '/ranked',
      );
      const tag = signal('a');

      const c = s.consumer();
      const pages = c.run(() =>
        createPagedQueryStack({
          queryCreator: getRanked,
          responseNormalizer: ethletePaginationAdapter,
          args: (page) => ({ queryParams: { page, tag: tag() } }),
          initialPage: 3,
        }),
      );
      s.tick();

      pages.fetchPreviousPage();
      s.tick();
      expect(pages.direction()).toBe('previous');

      for (const next of ['b', 'c', 'd']) {
        tag.set(next);
        s.tick();

        expect(pages.items()).toEqual([{ id: `${next}-3` }]);
        expect(pages.direction()).toBe('next');
      }

      c.destroy();
    });
  });

  describe('creators that differ only in wire options', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps a json, a text and a credentialed query on one route in separate cache entries', () => {
      const s = scenario();
      s.api.on('GET', '/report', () => ({ body: { n: 1 } }));

      const getJson = s.get<{ response: { n: number } }>('/report');
      const getText = s.get<{ response: string }>('/report', { responseType: 'text' });
      const getWithCredentials = s.get<{ response: { n: number } }>('/report', { withCredentials: true });

      const c = s.consumer();
      const json = c.run(() => getJson());
      const text = c.run(() => getText());
      const credentialed = c.run(() => getWithCredentials());
      s.tick();

      expect(s.api.requestCount('GET', '/report')).toBe(3);
      expect(s.api.httpRequests('GET', '/report').map((r) => [r.responseType, r.withCredentials])).toEqual([
        ['json', false],
        ['text', false],
        ['json', true],
      ]);
      expect(json.response()).toEqual({ n: 1 });
      expect(typeof text.response()).toBe('string');
      expect(credentialed.response()).toEqual({ n: 1 });

      c.destroy();
    });
  });
});

describe.each(LEGACY_CLIENT_KINDS)('*etQuery over a query collection on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('exposes the collection key as scope', () => {
    const s = scenario();
    const legacy = createLegacyClient(s, kind);
    s.api.on('POST', '/claims/:id/:action', () => ({ body: { ok: true }, delay: 50 }));

    const c = s.consumer([
      { provide: ACCEPT_CLAIM, useValue: legacy.post<ClaimArgs>((p) => `/claims/${p.id}/accept`) },
      { provide: DECLINE_CLAIM, useValue: legacy.post<ClaimArgs>((p) => `/claims/${p.id}/decline`) },
      { provide: CLIENT_KIND, useValue: kind },
    ]);
    const ref = s.mount(ClaimScopeHost, c.injector);

    for (const [type, id] of [
      ['accept', '1'],
      ['decline', '2'],
      ['accept', '3'],
    ] as const) {
      ref.instance.run(type, id);
      s.tick(100);

      expect(slot(ref, 'scope')).toBe(type);
    }

    ref.destroy();
    c.destroy();
    legacy.destroy();
  });
});
