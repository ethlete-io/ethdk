import { AsyncPipe } from '@angular/common';
import {
  Component,
  ComponentRef,
  computed,
  inject,
  InjectionToken,
  Injector,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  AnyQueryCollection,
  createQueryCollection,
  createQueryCollectionSignal,
  extractQuery,
  filterNull,
  ignoreAutoRefresh,
  isQueryStateCancelled,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStatePrepared,
  isQueryStateSuccess,
  queryComputed,
  QueryDirective,
  QueryField,
  QueryForm,
  queryStateResponseSignal,
  resetPageOnError,
  switchQueryCollectionState,
  switchQueryState,
  takeUntilResponse,
} from '../index';
import {
  createLegacyClient,
  LEGACY_CLIENT_KINDS,
  LegacyClientCreator,
  LegacyClientKind,
  LegacyClientQuery,
  Scenario,
  useScenario,
} from './harness';

type ShareLink = { token: string };
type ShareLinkArgs = { pathParams: { uuid: string }; config?: { destroyOnResponse: boolean } };
type ClaimArgs = { pathParams: { id: string } };
type CampaignsArgs = { queryParams: { page: number; limit: number; query?: string } };
type ChunkArgs = { pathParams: { ulid: string }; queryParams: { chunkNumber: number } };
type SeasonArgs = { pathParams: { season: string } };

type SubjectCreator<TArgs extends ShareLinkArgs | ChunkArgs> = LegacyClientCreator<TArgs> & {
  createSubject: () => BehaviorSubject<LegacyClientQuery | null>;
};

type ShareLinkCollection = { type: 'create' | 'refresh'; query: LegacyClientQuery };
type ClaimCollection = { type: 'accept' | 'decline'; query: LegacyClientQuery };

const CREATE_LINK = new InjectionToken<LegacyClientCreator<ShareLinkArgs>>('CREATE_LINK');
const REFRESH_LINK = new InjectionToken<LegacyClientCreator<ShareLinkArgs>>('REFRESH_LINK');
const ACCEPT_CLAIM = new InjectionToken<LegacyClientCreator<ClaimArgs>>('ACCEPT_CLAIM');
const DECLINE_CLAIM = new InjectionToken<LegacyClientCreator<ClaimArgs>>('DECLINE_CLAIM');
const GET_CAMPAIGNS = new InjectionToken<LegacyClientCreator<CampaignsArgs>>('GET_CAMPAIGNS');
const UPLOAD_CHUNK = new InjectionToken<SubjectCreator<ChunkArgs>>('UPLOAD_CHUNK');
const GET_SEASON = new InjectionToken<LegacyClientCreator<SeasonArgs>>('GET_SEASON');
const SEASON = new InjectionToken<WritableSignal<string>>('SEASON');
const CLIENT_KIND = new InjectionToken<LegacyClientKind>('CLIENT_KIND');

const injectHandlerInjector = () => (inject(CLIENT_KIND) === 'interop' ? inject(Injector) : undefined);

@Component({ template: '' })
class ShareLinkOverlayHost {
  private readonly createLink = inject(CREATE_LINK);
  private readonly refreshLink = inject(REFRESH_LINK);
  private readonly injector = injectHandlerInjector();

  readonly copied: string[] = [];

  readonly queryCollection = createQueryCollectionSignal({
    create: this.createLink as never,
    refresh: this.refreshLink as never,
  }) as unknown as WritableSignal<ShareLinkCollection | null>;
  readonly queryResponse = queryStateResponseSignal(this.queryCollection as never) as () => ShareLink | null;
  private readonly collectionState = toSignal(toObservable(this.queryCollection).pipe(switchQueryCollectionState()));
  readonly loading = computed(() => isQueryStateLoading(this.collectionState()));

  create(uuid: string) {
    this.run('create', this.createLink, uuid);
  }

  refresh(uuid: string) {
    this.run('refresh', this.refreshLink, uuid);
  }

  close() {
    this.queryCollection.set(null);
  }

  private run(type: ShareLinkCollection['type'], creator: LegacyClientCreator<ShareLinkArgs>, uuid: string) {
    const query = creator
      .prepare({
        pathParams: { uuid },
        ...(this.injector && { injector: this.injector, config: { destroyOnResponse: true } }),
      })
      .execute();

    this.queryCollection.set({ type, query });

    query.onSuccess((response) => this.copied.push((response as ShareLink).token));
  }
}

@Component({
  imports: [QueryDirective],
  template: `
    <ng-container *etQuery="claimQueryCollection(); loading as loading; error as error">
      <span data-slot="loading">{{ loading }}</span>
      <span data-slot="error">{{ error?.status ?? '-' }}</span>
    </ng-container>
  `,
})
class ClaimDetailHost {
  private readonly acceptClaim = inject(ACCEPT_CLAIM);
  private readonly declineClaim = inject(DECLINE_CLAIM);
  private readonly injector = injectHandlerInjector();

  readonly claimQueryCollection = createQueryCollectionSignal({
    accept: this.acceptClaim as never,
    decline: this.declineClaim as never,
  }) as unknown as WritableSignal<ClaimCollection | null>;

  accept(id: string) {
    this.claimQueryCollection.set({
      type: 'accept',
      query: this.acceptClaim
        .prepare({ pathParams: { id }, ...(this.injector && { injector: this.injector }) })
        .execute(),
    });
  }

  retry() {
    extractQuery(this.claimQueryCollection() as unknown as AnyQueryCollection)?.execute({ skipCache: true });
  }
}

@Component({
  imports: [AsyncPipe, QueryDirective],
  template: `
    <ng-container *etQuery="actionQuery$ | async; loading as loading; error as error">
      <span data-slot="loading">{{ loading }}</span>
      <span data-slot="type">{{ (actionQuery$ | async)?.type ?? '-' }}</span>
    </ng-container>
  `,
})
class CollectionDialogHost {
  private readonly acceptClaim = inject(ACCEPT_CLAIM);
  private readonly declineClaim = inject(DECLINE_CLAIM);
  private readonly injector = injectHandlerInjector();

  readonly created: string[] = [];

  readonly actionQuery$ = createQueryCollection({
    accept: this.acceptClaim as never,
    decline: this.declineClaim as never,
  }) as unknown as BehaviorSubject<ClaimCollection | null>;

  act(type: ClaimCollection['type'], id: string) {
    const creator = type === 'accept' ? this.acceptClaim : this.declineClaim;
    const query = creator.prepare({ pathParams: { id }, ...(this.injector && { injector: this.injector }) }).execute();

    this.actionQuery$.next({ query, type });

    const queryCollection = this.actionQuery$.value;

    queryCollection?.query.state$
      .pipe(
        tap((state) => {
          if (isQueryStateSuccess(state)) this.created.push(`${type}:${id}`);
        }),
        takeUntilResponse(),
      )
      .subscribe();
  }
}

@Component({ template: '' })
class CampaignsTableHost {
  private readonly getCampaigns = inject(GET_CAMPAIGNS);
  private readonly injector = injectHandlerInjector();
  readonly getCampaignsQuery = signal<LegacyClientQuery | null>(null);
  readonly campaignsResponse = queryStateResponseSignal(this.getCampaignsQuery, { cacheResponse: true });

  readonly queryForm = new QueryForm({
    page: new QueryField({ control: new FormControl<number>(1), isResetBy: ['query', 'limit'] }),
    limit: new QueryField({ control: new FormControl<number>(10) }),
    query: new QueryField({ control: new FormControl<string | null>(null), debounce: 300 }),
  });

  constructor() {
    this.queryForm.observe();

    this.queryForm.changes$
      .pipe(
        map(({ currentValue }) =>
          this.getCampaigns
            .prepare({
              queryParams: {
                limit: currentValue?.limit ?? 10,
                page: currentValue?.page ?? 1,
                query: currentValue?.query ?? undefined,
              },
              ...(this.injector && { injector: this.injector }),
            })
            .execute(),
        ),
        tap((q) => this.getCampaignsQuery.set(q)),
        resetPageOnError({ queryForm: this.queryForm as never }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}

class UploadChunk {
  private readonly query$: BehaviorSubject<LegacyClientQuery | null>;

  constructor(
    private readonly creator: SubjectCreator<ChunkArgs>,
    private readonly chunkNumber: number,
    private readonly injector: Injector | undefined,
  ) {
    this.query$ = creator.createSubject();
  }

  get state$(): Observable<'idle' | 'loading' | 'failed' | 'completed'> {
    return this.query$.pipe(
      switchQueryState(),
      map((state) => {
        if (!state || isQueryStatePrepared(state)) {
          return 'idle';
        } else if (isQueryStateLoading(state)) {
          return 'loading';
        } else if (isQueryStateFailure(state) || isQueryStateCancelled(state)) {
          return 'failed';
        }

        return 'completed';
      }),
    );
  }

  upload() {
    this.query$.value?.abort();

    this.query$.next(
      this.creator
        .prepare({
          pathParams: { ulid: 'u1' },
          queryParams: { chunkNumber: this.chunkNumber },
          ...(this.injector && { injector: this.injector }),
        })
        .execute(),
    );
  }

  cancel() {
    if (!this.query$.value) return;

    this.query$.value.abort();
    this.query$.next(null);
  }
}

@Component({ template: '' })
class UploaderHost {
  private readonly creator = inject(UPLOAD_CHUNK);
  private readonly injector = injectHandlerInjector();

  readonly chunks = [1, 2, 3].map((n) => new UploadChunk(this.creator, n, this.injector)) as [
    UploadChunk,
    UploadChunk,
    UploadChunk,
  ];
  readonly states = this.chunks.map((chunk) => toSignal(chunk.state$, { initialValue: 'idle' as const }));
}

@Component({ template: '' })
class SeasonPermissionsHost {
  private readonly getSeason = inject(GET_SEASON);
  private readonly season = inject(SEASON);

  readonly getSeasonQuery = queryComputed(() =>
    this.getSeason.prepare({ pathParams: { season: this.season() } }).execute(),
  );
  readonly seasonResponse = queryStateResponseSignal(this.getSeasonQuery, { cacheResponse: true });
  readonly seasonResponseCached = toSignal(toObservable(this.seasonResponse).pipe(filterNull()), {
    initialValue: null,
  });
}

@Component({ template: '' })
class SeasonBannerHost {
  private readonly getSeason = inject(GET_SEASON);
  private readonly season = inject(SEASON);

  readonly getSeasonQuery = queryComputed(() =>
    this.getSeason.prepare({ pathParams: { season: this.season() } }).execute(),
  );
  private readonly visibleState = toSignal(
    toObservable(this.getSeasonQuery).pipe(switchQueryState(), ignoreAutoRefresh()),
  );
  readonly loading = computed(() => isQueryStateLoading(this.visibleState()));
}

const slot = (ref: ComponentRef<unknown>, name: string) =>
  ((ref.location.nativeElement as HTMLElement).querySelector(`[data-slot="${name}"]`)?.textContent ?? '').trim();

const expectInteropFailureReports = (s: Scenario, kind: LegacyClientKind, status: number, count: number) => {
  expect(s.errors).toHaveLength(kind === 'interop' ? count : 0);

  if (kind === 'interop') {
    for (let i = 0; i < count; i++) {
      s.expectError((entry) => (entry.error as { status?: number }).status === status);
    }
  }
};

describe.each(LEGACY_CLIENT_KINDS)('legacy collections and pipes on the %s client', (kind) => {
  describe('createQueryCollectionSignal switched between two mutations', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends one request per action, follows the latest query and releases the replaced one', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      let issued = 0;
      s.api.on('POST', '/collections/:uuid/share-links', () => ({ body: { token: `t${++issued}` }, delay: 100 }));
      s.api.on('POST', '/collections/:uuid/share-links/refresh', () => ({
        body: { token: `t${++issued}` },
        delay: 100,
      }));

      const c = s.consumer([
        { provide: CREATE_LINK, useValue: legacy.post<ShareLinkArgs>((p) => `/collections/${p.uuid}/share-links`) },
        {
          provide: REFRESH_LINK,
          useValue: legacy.post<ShareLinkArgs>((p) => `/collections/${p.uuid}/share-links/refresh`),
        },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(ShareLinkOverlayHost, c.injector);
      const host = ref.instance;

      expect(host.queryResponse()).toBeNull();
      expect(host.loading()).toBe(false);

      host.create('c1');
      s.tick(10);
      expect(host.loading()).toBe(true);

      s.tick(1000);
      expect(host.loading()).toBe(false);
      expect(host.queryResponse()).toEqual({ token: 't1' });

      for (const expected of ['t2', 't3']) {
        host.refresh('c1');
        s.tick(10);
        expect(host.loading()).toBe(true);

        s.tick(1000);
        expect(host.queryResponse()).toEqual({ token: expected });
      }

      host.create('c1');
      s.tick(1000);

      expect(host.queryResponse()).toEqual({ token: 't4' });
      expect(host.copied).toEqual(['t1', 't2', 't3', 't4']);
      expect(s.api.requestCount('POST', '/collections/c1/share-links')).toBe(2);
      expect(s.api.requestCount('POST', '/collections/c1/share-links/refresh')).toBe(2);
      expect(legacy.liveQueries()).toEqual(kind === 'native' ? [host.queryCollection()?.query] : []);

      host.close();
      s.tick(10);
      expect(host.queryResponse()).toBeNull();
      expect(legacy.liveQueries()).toEqual([]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('extractQuery retrying the query a collection holds', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('re-sends the held mutation once per retry and renders its state through *etQuery', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      let attempts = 0;
      s.api.on('POST', '/claims/:id/accept', () =>
        ++attempts < 4 ? { status: 409, body: { message: 'busy' }, delay: 50 } : { body: { ok: true }, delay: 50 },
      );

      const c = s.consumer([
        { provide: ACCEPT_CLAIM, useValue: legacy.post<ClaimArgs>((p) => `/claims/${p.id}/accept`) },
        { provide: DECLINE_CLAIM, useValue: legacy.post<ClaimArgs>((p) => `/claims/${p.id}/decline`) },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(ClaimDetailHost, c.injector);

      expect(extractQuery(null)).toBeNull();

      ref.instance.accept('7');
      s.tick(10);
      expect(slot(ref, 'loading')).toBe('true');

      s.tick(1000);
      expect(slot(ref, 'error')).toBe('409');

      const held = ref.instance.claimQueryCollection()?.query;
      expect(extractQuery(held as never)).toBe(held);

      for (const attempt of [2, 3, 4]) {
        ref.instance.retry();
        s.tick(10);
        expect(slot(ref, 'loading')).toBe('true');
        expect(s.api.requestCount('POST', '/claims/7/accept')).toBe(attempt);

        s.tick(1000);
      }

      expect(slot(ref, 'error')).toBe('-');
      expect(slot(ref, 'loading')).toBe('false');
      expect(s.api.requestCount('POST', '/claims/7/accept')).toBe(4);
      expectInteropFailureReports(s, kind, 409, 3);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('createQueryCollection as a BehaviorSubject behind *etQuery | async', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('renders the latest action and reports each success once', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('POST', '/claims/:id/accept', () => ({ body: { ok: true }, delay: 50 }));
      s.api.on('POST', '/claims/:id/decline', () => ({ body: { ok: true }, delay: 50 }));

      const c = s.consumer([
        { provide: ACCEPT_CLAIM, useValue: legacy.post<ClaimArgs>((p) => `/claims/${p.id}/accept`) },
        { provide: DECLINE_CLAIM, useValue: legacy.post<ClaimArgs>((p) => `/claims/${p.id}/decline`) },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(CollectionDialogHost, c.injector);

      expect(slot(ref, 'type')).toBe('-');

      for (const [type, id] of [
        ['accept', '1'],
        ['decline', '2'],
        ['accept', '3'],
      ] as const) {
        ref.instance.act(type, id);
        s.tick(10);
        expect(slot(ref, 'type')).toBe(type);
        expect(slot(ref, 'loading')).toBe('true');

        s.tick(1000);
        expect(slot(ref, 'loading')).toBe('false');
      }

      expect(ref.instance.created).toEqual(['accept:1', 'decline:2', 'accept:3']);
      expect(s.api.requests.map((request) => `${request.path}:${request.aborted}`)).toEqual([
        '/claims/1/accept:false',
        '/claims/2/decline:false',
        '/claims/3/accept:false',
      ]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('resetPageOnError after a QueryForm changes$ pipeline', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends the list request again for page 1 when the page is out of range', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/campaigns', ({ query }) => {
        const page = Number(query['page']);

        if (page <= 2) return { body: { items: [`p${page}`], totalPages: 2 }, delay: 50 };

        return page % 2
          ? { status: 416, body: { message: 'out of range' }, delay: 50 }
          : {
              status: 500,
              body: {
                class: 'Pagerfanta\\Exception\\OutOfRangeCurrentPageException',
                detail: 'Page "4" does not exist.',
                status: 500,
                title: 'Internal Server Error',
                trace: [],
                type: 'https://tools.ietf.org/html/rfc2616#section-10',
              },
              delay: 50,
            };
      });

      const c = s.consumer([
        { provide: GET_CAMPAIGNS, useValue: legacy.get<CampaignsArgs>('/campaigns') },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(CampaignsTableHost, c.injector);
      const { page } = ref.instance.queryForm.form.controls;

      s.tick(1000);
      expect(ref.instance.campaignsResponse()).toEqual({ items: ['p1'], totalPages: 2 });

      for (const [outOfRange, status] of [
        [3, 416],
        [4, 500],
        [5, 416],
      ] as const) {
        page.setValue(outOfRange);
        s.flush();

        expect(page.value).toBe(1);
        expect(ref.instance.campaignsResponse()).toEqual({ items: ['p1'], totalPages: 2 });
        expectInteropFailureReports(s, kind, status, 1);
      }

      expect(s.api.requests.map((request) => request.query['page'])).toEqual(['1', '3', '1', '4', '1', '5', '1']);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('legacy state guards over a createSubject container', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('maps prepared, loading, failure, cancelled and success states per chunk', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('POST', '/upload/:ulid/chunk', ({ query }) =>
        query['chunkNumber'] === '2'
          ? { status: 413, body: { message: 'disk full' }, delay: 100 }
          : { body: { ok: true }, delay: 100 },
      );

      const c = s.consumer([
        { provide: UPLOAD_CHUNK, useValue: legacy.post<ChunkArgs>((p) => `/upload/${p.ulid}/chunk`) },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(UploaderHost, c.injector);
      const [first, second, third] = ref.instance.chunks;
      const states = () => ref.instance.states.map((state) => state());

      expect(states()).toEqual(['idle', 'idle', 'idle']);

      first.upload();
      second.upload();
      third.upload();
      s.tick(10);
      expect(states()).toEqual(['loading', 'loading', 'loading']);

      third.cancel();
      s.tick(10);
      expect(states()).toEqual(['loading', 'loading', 'idle']);

      s.tick(1000);
      expect(states()).toEqual(['completed', 'failed', 'idle']);
      expectInteropFailureReports(s, kind, 413, 1);

      third.upload();
      s.tick(10);
      expect(states()).toEqual(['completed', 'failed', 'loading']);

      s.tick(1000);
      expect(states()).toEqual(['completed', 'failed', 'completed']);
      expect(s.api.requests.map((request) => `${request.query['chunkNumber']}:${request.aborted}`)).toEqual([
        '1:false',
        '2:false',
        '3:true',
        '3:false',
      ]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('filterNull over a cached queryComputed response', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps the last response while each new season loads', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/seasons/:season', ({ params }) => ({ body: { season: params['season'] }, delay: 100 }));

      const season = signal('s1');
      const c = s.consumer([
        { provide: GET_SEASON, useValue: legacy.get<SeasonArgs>((p) => `/seasons/${p.season}`) },
        { provide: SEASON, useValue: season },
      ]);
      const ref = s.mount(SeasonPermissionsHost, c.injector);

      expect(ref.instance.seasonResponseCached()).toBeNull();

      s.tick(1000);
      expect(ref.instance.seasonResponseCached()).toEqual({ season: 's1' });

      for (const next of ['s2', 's3', 's4']) {
        season.set(next);
        s.tick(10);
        expect(ref.instance.seasonResponseCached()).not.toBeNull();

        s.tick(1000);
        expect(ref.instance.seasonResponseCached()).toEqual({ season: next });
      }

      for (const done of ['s1', 's2', 's3', 's4']) {
        expect(s.api.requestCount('GET', `/seasons/${done}`)).toBe(1);
      }

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('ignoreAutoRefresh over a queryComputed state stream', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    const refreshInBackground = (s: Scenario) => {
      if (kind === 'interop') {
        s.client.refreshQueriesInUse();

        return;
      }

      window.dispatchEvent(new Event('blur'));
      s.tick(21_000);
      window.dispatchEvent(new Event('focus'));
    };

    it('shows loading for arg changes but not for a background refresh', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/seasons/:season', ({ params }) => ({ body: { season: params['season'] }, delay: 100 }));

      const season = signal('s1');
      const c = s.consumer([
        { provide: GET_SEASON, useValue: legacy.get<SeasonArgs>((p) => `/seasons/${p.season}`) },
        { provide: SEASON, useValue: season },
      ]);
      const ref = s.mount(SeasonBannerHost, c.injector);

      s.tick(10);
      expect(ref.instance.loading()).toBe(true);
      s.tick(1000);
      expect(ref.instance.loading()).toBe(false);

      for (const next of ['s2', 's3', 's4']) {
        season.set(next);
        s.tick(10);
        expect(ref.instance.loading()).toBe(true);
        s.tick(1000);
        expect(ref.instance.loading()).toBe(false);
      }

      refreshInBackground(s);
      s.tick(10);
      expect(ref.instance.loading()).toBe(false);
      expect(s.api.requestCount('GET', '/seasons/s4')).toBe(2);

      s.tick(1000);
      expect(ref.instance.loading()).toBe(false);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });
});
