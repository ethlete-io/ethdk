import {
  Component,
  effect,
  inject,
  InjectionToken,
  Injector,
  OnDestroy,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, combineLatest, debounceTime, Subject, takeUntil, tap } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { queryComputed, QueryField, QueryForm, queryStateResponseSignal, SearchQueryField } from '../index';
import {
  createLegacyClient,
  LEGACY_CLIENT_KINDS,
  LegacyClientCreator,
  LegacyClientKind,
  LegacyClientQuery,
  Scenario,
  useScenario,
} from './harness';

type SearchUsersArgs = { body: { query: string; page: number; organizationUuid: string } };
type GetLeaguesArgs = {
  pathParams: { seasonSlug: string };
  queryParams: { page: number; limit: number; query?: string };
};
type LeaguesPage = { items: string[]; totalPages: number };

type SubjectCreator<TArgs extends SearchUsersArgs> = LegacyClientCreator<TArgs> & {
  createSubject: () => BehaviorSubject<LegacyClientQuery | null>;
};

const SEARCH_USERS = new InjectionToken<SubjectCreator<SearchUsersArgs>>('SEARCH_USERS');
const GET_LEAGUES = new InjectionToken<LegacyClientCreator<GetLeaguesArgs>>('GET_LEAGUES');
const CLUB_ID = new InjectionToken<WritableSignal<string>>('CLUB_ID');
const SEASON_SLUG = new InjectionToken<WritableSignal<string | null>>('SEASON_SLUG');
const CLIENT_KIND = new InjectionToken<LegacyClientKind>('CLIENT_KIND');

@Component({ template: '' })
class ClubUsersHost implements OnInit, OnDestroy {
  private readonly getUserSearch = inject(SEARCH_USERS);
  private readonly clubId$ = toObservable(inject(CLUB_ID));
  private readonly injector = inject(CLIENT_KIND) === 'interop' ? inject(Injector) : undefined;
  private readonly destroy$ = new Subject<void>();

  readonly getUserSearchQuery$ = this.getUserSearch.createSubject();

  readonly queryForm = new QueryForm({
    search: new QueryField({ control: new FormControl<string | null>(null) }),
    paginationControl: new QueryField({ control: new FormControl(1), isResetBy: 'search' }),
  });

  ngOnInit() {
    this.queryForm.observe({ replaceUrl: true });

    combineLatest([this.queryForm.changes$, this.clubId$])
      .pipe(
        debounceTime(300),
        tap(([{ currentValue }, clubId]) => {
          this.getUserSearchQuery$.next(
            this.getUserSearch
              .prepare({
                body: {
                  query: currentValue.search ?? '',
                  page: currentValue.paginationControl ?? 1,
                  organizationUuid: clubId,
                },
                ...(this.injector && { injector: this.injector }),
              })
              .execute(),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }
}

@Component({ template: '' })
class CompetitionOverviewHost {
  private readonly legacyGetLeagues = inject(GET_LEAGUES);
  private readonly selectedSeasonSlug = inject(SEASON_SLUG);

  readonly queryForm = new QueryForm({
    page: new QueryField({ control: new FormControl<number>(1), isResetBy: ['query', 'limit'] }),
    limit: new QueryField({ control: new FormControl<number>(10) }),
    query: new SearchQueryField(),
  }).observe();

  readonly internationalLeaguesQuery = queryComputed(() => {
    const queryFormValue = this.queryForm.currentValue();
    const seasonSlug = this.selectedSeasonSlug();

    if (!seasonSlug) return null;

    return this.legacyGetLeagues
      .prepare({
        pathParams: { seasonSlug },
        queryParams: {
          page: queryFormValue?.page ?? 1,
          limit: queryFormValue?.limit ?? 10,
          query: queryFormValue?.query ?? undefined,
        },
      })
      .execute();
  });

  readonly leaguesResponse = queryStateResponseSignal(this.internationalLeaguesQuery);

  constructor() {
    effect(() => {
      const response = this.leaguesResponse() as LeaguesPage | null;
      const currentPage = this.queryForm.controls.page.value;

      if (response && currentPage && response.totalPages && currentPage > response.totalPages) {
        this.queryForm.controls.page.setValue(response.totalPages);
      }
    });
  }
}

const urlParams = () => {
  const router = TestBed.inject(Router);

  return router.parseUrl(router.url).queryParams;
};

const searchBodies = (s: Scenario) =>
  s.api.requests.map((request) => {
    const body = request.body as SearchUsersArgs['body'];

    return `${body.organizationUuid}:${body.query}:${body.page}`;
  });

const leagueRequests = (s: Scenario) =>
  s.api.requests.map(
    (request) =>
      `${request.path}?page=${request.query['page']}&limit=${request.query['limit']}&q=${request.query['query'] ?? ''}`,
  );

describe.each(LEGACY_CLIENT_KINDS)('legacy QueryForm patterns on the %s client', (kind) => {
  describe('changes$ combined with another stream, debounced into a createSubject container', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('posts once per settled change, resets the page on a new search and keeps one live query', async () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('POST', '/users/search', ({ body }) => ({ body: { items: [], echo: body }, delay: 50 }));

      const clubId = signal('club-1');
      const c = s.consumer([
        { provide: SEARCH_USERS, useValue: legacy.post<SearchUsersArgs>('/users/search') },
        { provide: CLUB_ID, useValue: clubId },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(ClubUsersHost, c.injector);
      await s.settle(1000);

      expect(searchBodies(s)).toEqual(['club-1::1']);

      const { search, paginationControl } = ref.instance.queryForm.form.controls;

      for (const page of [2, 3]) {
        paginationControl.setValue(page);
        await s.settle(1000);
      }

      expect(urlParams()).toEqual({ paginationControl: '3' });

      for (const value of ['a', 'ad', 'ada']) {
        search.setValue(value);
        await s.settle(50);
      }

      await s.settle(1000);

      expect(paginationControl.value).toBe(1);
      expect(urlParams()).toEqual({ search: 'ada' });

      for (const next of ['club-2', 'club-3', 'club-4']) {
        clubId.set(next);
        await s.settle(1000);
      }

      expect(searchBodies(s)).toEqual([
        'club-1::1',
        'club-1::2',
        'club-1::3',
        'club-1:ada:1',
        'club-2:ada:1',
        'club-3:ada:1',
        'club-4:ada:1',
      ]);
      expect(legacy.liveQueries()).toEqual([ref.instance.getUserSearchQuery$.value]);

      ref.destroy();
      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      legacy.destroy();
    });
  });

  describe('currentValue() read inside queryComputed next to a page-clamping effect', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    const setup = async () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/seasons/:slug/leagues', ({ query }) => ({
        body: { items: [`page ${query['page']}`], totalPages: 3 },
        delay: 50,
      }));

      const seasonSlug = signal<string | null>(null);
      const c = s.consumer([
        {
          provide: GET_LEAGUES,
          useValue: legacy.get<GetLeaguesArgs>((p) => `/seasons/${p.seasonSlug}/leagues`),
        },
        { provide: SEASON_SLUG, useValue: seasonSlug },
      ]);
      const ref = s.mount(CompetitionOverviewHost, c.injector);
      await s.settle(1000);

      return { s, legacy, c, ref, seasonSlug };
    };

    it('waits for the season, then sends one request per season change', async () => {
      const { s, legacy, c, ref, seasonSlug } = await setup();

      expect(s.api.requests).toEqual([]);
      expect(ref.instance.internationalLeaguesQuery()).toBeNull();

      for (const slug of ['2024', '2025', '2026']) {
        seasonSlug.set(slug);
        await s.settle(1000);
      }

      expect(leagueRequests(s)).toEqual([
        '/seasons/2024/leagues?page=1&limit=10&q=',
        '/seasons/2025/leagues?page=1&limit=10&q=',
        '/seasons/2026/leagues?page=1&limit=10&q=',
      ]);
      expect(ref.instance.leaguesResponse()).toEqual({ items: ['page 1'], totalPages: 3 });
      expect(legacy.liveQueries()).toEqual([ref.instance.internationalLeaguesQuery()]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('resets the page on a limit change and clamps a page past the end with one extra request', async () => {
      const { s, legacy, c, ref, seasonSlug } = await setup();
      seasonSlug.set('2026');
      await s.settle(1000);

      const { page, limit } = ref.instance.queryForm.form.controls;

      for (const next of [2, 3]) {
        page.setValue(next);
        await s.settle(1000);
      }

      limit.setValue(25);
      await s.settle(1000);
      expect(page.value).toBe(1);

      page.setValue(7);
      await s.settle(1000);
      expect(page.value).toBe(3);

      await s.settle(5000);

      expect(leagueRequests(s)).toEqual([
        '/seasons/2026/leagues?page=1&limit=10&q=',
        '/seasons/2026/leagues?page=2&limit=10&q=',
        '/seasons/2026/leagues?page=3&limit=10&q=',
        '/seasons/2026/leagues?page=1&limit=25&q=',
        '/seasons/2026/leagues?page=7&limit=25&q=',
        '/seasons/2026/leagues?page=3&limit=25&q=',
      ]);
      expect(urlParams()).toEqual({ page: '3', limit: '25' });
      expect(legacy.liveQueries()).toEqual([ref.instance.internationalLeaguesQuery()]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('keeps the search debounce when the first keystroke resets the page', async () => {
      const { s, legacy, c, ref, seasonSlug } = await setup();
      seasonSlug.set('2026');
      await s.settle(1000);

      const { page, query } = ref.instance.queryForm.form.controls;

      page.setValue(2);
      await s.settle(1000);

      for (const value of ['b', 'bu', 'bun']) {
        query.setValue(value);
        await s.settle(50);
      }

      await s.settle(1000);

      expect(page.value).toBe(1);
      expect(leagueRequests(s)).toEqual([
        '/seasons/2026/leagues?page=1&limit=10&q=',
        '/seasons/2026/leagues?page=2&limit=10&q=',
        '/seasons/2026/leagues?page=1&limit=10&q=bun',
      ]);
      expect(urlParams()).toEqual({ query: 'bun' });

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });
});
