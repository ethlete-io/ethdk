import {
  Component,
  ComponentRef,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  Injector,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, filter, map, of, startWith, switchMap, tap, timer } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  AnyInfinityQueryConfig,
  createInfinityQueryConfig,
  filterFailure,
  filterSuccess,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  isQueryStateSuccess,
  queryComputed,
  queryStateResponseSignal,
  switchQueryState,
  takeUntilResponse,
} from '../index';
import {
  createLegacyClient,
  LEGACY_CLIENT_KINDS,
  LegacyClientCreator,
  LegacyClientKind,
  Scenario,
  useScenario,
} from './harness';

type User = { id: string; name: string };
type Campaign = { uuid: string };
type GetUserArgs = { pathParams: { id: string } };
type UploadArgs = { body: { name: string } };
type ListCampaignsArgs = { queryParams: { page: number } };
type ArchiveCampaignArgs = { pathParams: { uuid: string }; config?: { destroyOnResponse: boolean } };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');
const GET_PERMISSIONS = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_PERMISSIONS');
const UPLOAD = new InjectionToken<LegacyClientCreator<UploadArgs>>('UPLOAD');
const LIST_CAMPAIGNS = new InjectionToken<LegacyClientCreator<ListCampaignsArgs>>('LIST_CAMPAIGNS');
const ARCHIVE_CAMPAIGN = new InjectionToken<LegacyClientCreator<ArchiveCampaignArgs>>('ARCHIVE_CAMPAIGN');
const USER_ID = new InjectionToken<WritableSignal<string>>('USER_ID');
const REFRESHED = new InjectionToken<WritableSignal<number>>('REFRESHED');
const CLIENT_KIND = new InjectionToken<LegacyClientKind>('CLIENT_KIND');
const INFINITY_CONFIG = new InjectionToken<AnyInfinityQueryConfig>('INFINITY_CONFIG');

const nameOf = (user: unknown) => (user as User | null)?.name ?? '-';

const injectHandlerInjector = () => (inject(CLIENT_KIND) === 'interop' ? inject(Injector) : undefined);

@Component({ template: '' })
class StaticUserHost {
  private readonly getUser = inject(GET_USER);

  readonly name = toSignal(
    of(this.getUser.prepare({ pathParams: { id: '1' } }).execute()).pipe(
      switchQueryState(),
      filterSuccess(),
      map((state) => nameOf(state.response)),
    ),
  );
}

@Component({ template: '' })
class SwitchingUserHost {
  private readonly getUser = inject(GET_USER);
  private readonly id = inject(USER_ID);

  readonly query = queryComputed(() => this.getUser.prepare({ pathParams: { id: this.id() } }).execute());
  readonly name = toSignal(
    toObservable(this.query).pipe(
      switchQueryState(),
      filterSuccess(),
      map((state) => nameOf(state.response)),
    ),
  );
}

@Component({ template: '' })
class UploadHost {
  private readonly upload = inject(UPLOAD);
  private readonly injector = injectHandlerInjector();

  readonly uploadQuery = this.upload.createSignal();
  readonly showError = toSignal(
    toObservable(this.uploadQuery).pipe(
      switchQueryState(),
      filterFailure(),
      switchMap(() =>
        timer(800).pipe(
          map(() => true),
          startWith(false),
        ),
      ),
    ),
    { initialValue: false },
  );

  send(name: string) {
    this.uploadQuery.set(
      this.upload.prepare({ body: { name }, ...(this.injector && { injector: this.injector }) }).execute(),
    );
  }
}

@Component({ template: '' })
class LoggedInHost {
  private readonly getUser = inject(GET_USER);
  private readonly getPermissions = inject(GET_PERMISSIONS);

  readonly userQuery$ = this.getUser.behaviorSubject();
  readonly permissionsQuery$ = this.getPermissions.behaviorSubject();

  readonly isUserLoggedIn = toSignal(
    combineLatest([
      this.userQuery$.pipe(switchQueryState(), takeUntilResponse()),
      this.permissionsQuery$.pipe(switchQueryState(), takeUntilResponse()),
    ]).pipe(
      map(([userState, permissionsState]) => isQueryStateSuccess(userState) && isQueryStateSuccess(permissionsState)),
    ),
  );

  constructor() {
    this.userQuery$.next(this.getUser.prepare({ pathParams: { id: '1' } }).execute());
    this.permissionsQuery$.next(this.getPermissions.prepare({ pathParams: { id: '1' } }).execute());
  }
}

@Component({ template: '' })
class EditTeamHost {
  private readonly getTeam = inject(GET_USER);
  private readonly id = inject(USER_ID);
  private readonly refreshed = inject(REFRESHED);

  effectRuns = 0;

  readonly query = queryComputed(() => this.getTeam.prepare({ pathParams: { id: this.id() } }).execute());

  constructor() {
    effect(() => {
      this.effectRuns++;

      if (this.refreshed()) {
        this.query()?.execute({ skipCache: true, cancelPrevious: true });
      }
    });
  }
}

@Component({ template: '' })
class CampaignsTableHost {
  private readonly listCampaigns = inject(LIST_CAMPAIGNS);
  private readonly archiveCampaign = inject(ARCHIVE_CAMPAIGN);
  private readonly injector = injectHandlerInjector();
  private readonly destroyRef = inject(DestroyRef);

  readonly listQuery = queryComputed(() => this.listCampaigns.prepare({ queryParams: { page: 1 } }).execute());
  readonly list = queryStateResponseSignal(this.listQuery);

  archive(uuid: string) {
    of({ confirmed: true })
      .pipe(
        filter((result) => result.confirmed),
        map(() =>
          this.archiveCampaign
            .prepare({
              pathParams: { uuid },
              ...(this.injector && { injector: this.injector, config: { destroyOnResponse: true } }),
            })
            .execute(),
        ),
        switchQueryState(),
        filterSuccess(),
        tap(() => this.listQuery()?.execute({ skipCache: true })),
        takeUntilResponse(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config; let items; let error = error">
      <span data-slot="items">{{ ids(items) }}</span>
      <span data-slot="error">{{ error?.status ?? '-' }}</span>
      <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
    </div>
  `,
})
class InfinityListHost {
  readonly config = inject(INFINITY_CONFIG);

  ids = (items: { id: string }[] | null) => (items ?? []).map((item) => item.id).join(',');
}

const slot = (ref: ComponentRef<unknown>, name: string) =>
  ((ref.location.nativeElement as HTMLElement).querySelector(`[data-slot="${name}"]`)?.textContent ?? '').trim();

const expectInteropFailureReport = (s: Scenario, kind: LegacyClientKind, status: number) => {
  expect(s.errors).toHaveLength(kind === 'interop' ? 1 : 0);
  if (kind === 'interop') s.expectError((entry) => (entry.error as { status?: number }).status === status);
};

describe.each(LEGACY_CLIENT_KINDS)('legacy rxjs patterns on the %s client', (kind) => {
  describe('of(prepare().execute()) piped through switchQueryState into toSignal', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('emits the mapped response once it lands and releases the query on destroy', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: `User ${params['id']}` },
        delay: 100,
      }));

      const c = s.consumer([{ provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) }]);
      const ref = s.mount(StaticUserHost, c.injector);

      s.tick(10);
      expect(ref.instance.name()).toBeUndefined();

      s.tick(1000);
      expect(ref.instance.name()).toBe('User 1');
      expect(s.api.requestCount('GET', '/users/1')).toBe(1);

      ref.destroy();
      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      legacy.destroy();
    });
  });

  describe('toObservable(queryComputed) piped through switchQueryState into toSignal', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('emits the latest query only and keeps the last value while the next one loads', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: `User ${params['id']}` },
        delay: params['id'] === '1' ? 500 : 100,
      }));

      const id = signal('1');
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
      ]);
      const ref = s.mount(SwitchingUserHost, c.injector);

      s.tick(10);

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);

        expect(ref.instance.name()).toBeUndefined();
      }

      s.tick(1000);
      expect(ref.instance.name()).toBe('User 4');

      id.set('5');
      s.tick(10);
      expect(ref.instance.name()).toBe('User 4');

      s.tick(1000);
      expect(ref.instance.name()).toBe('User 5');

      for (const done of ['1', '2', '3', '4', '5']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false, false]);

      ref.destroy();
      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      legacy.destroy();
    });
  });

  describe('filterFailure into a timer from a createSignal container', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    const setup = () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('POST', '/uploads', ({ body }) =>
        (body as UploadArgs['body']).name.startsWith('bad')
          ? { status: 422, body: { message: 'invalid file' }, delay: 50 }
          : { status: 201, body, delay: 50 },
      );

      const c = s.consumer([
        { provide: UPLOAD, useValue: legacy.post<UploadArgs>('/uploads') },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(UploadHost, c.injector);

      return { s, legacy, c, ref };
    };

    it('shows the error 800 ms after a failed upload, once per failure', () => {
      const { s, legacy, c, ref } = setup();

      ref.instance.send('ok');
      s.tick(1000);
      expect(ref.instance.showError()).toBe(false);

      for (const attempt of [1, 2, 3]) {
        ref.instance.send(`bad ${attempt}`);
        s.tick(100);
        expect(ref.instance.showError()).toBe(false);

        s.tick(800);
        expect(ref.instance.showError()).toBe(true);
        expectInteropFailureReport(s, kind, 422);
      }

      expect(s.api.requestCount('POST', '/uploads')).toBe(4);
      expect(legacy.liveQueries()).toEqual([ref.instance.uploadQuery()]);

      ref.destroy();
      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      legacy.destroy();
    });

    it('drops the pending error timer when the component is destroyed', () => {
      const { s, legacy, c, ref } = setup();

      ref.instance.send('bad');
      s.tick(100);
      expect(ref.instance.showError()).toBe(false);
      expectInteropFailureReport(s, kind, 422);

      ref.destroy();
      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      legacy.destroy();
    });
  });

  describe('takeUntilResponse after switchQueryState inside combineLatest', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('turns true once both queries succeed and stops listening after the first response', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'User' }, delay: 50 }));
      s.api.on('GET', '/permissions/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 200 }));

      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: GET_PERMISSIONS, useValue: legacy.get<GetUserArgs>((p) => `/permissions/${p.id}`) },
      ]);
      const ref = s.mount(LoggedInHost, c.injector);

      s.tick(10);
      expect(ref.instance.isUserLoggedIn()).toBe(false);

      s.tick(100);
      expect(ref.instance.isUserLoggedIn()).toBe(false);

      s.tick(200);
      expect(ref.instance.isUserLoggedIn()).toBe(true);

      ref.instance.userQuery$.value?.execute({ skipCache: true });
      s.tick(10);
      expect(ref.instance.isUserLoggedIn()).toBe(true);

      s.tick(1000);
      expect(ref.instance.isUserLoggedIn()).toBe(true);
      expect(s.api.requestCount('GET', '/users/1')).toBe(2);
      expect(s.api.requestCount('GET', '/permissions/1')).toBe(1);

      ref.destroy();
      c.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      legacy.destroy();
    });
  });

  describe('an effect that re-executes a queryComputed on another signal', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends one request per change, aborts the previous one and does not re-run on the response', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'], name: 'Team' }, delay: 100 }));

      const refreshed = signal(0);
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/teams/${p.id}`) },
        { provide: USER_ID, useValue: signal('1') },
        { provide: REFRESHED, useValue: refreshed },
      ]);
      const ref = s.mount(EditTeamHost, c.injector);

      s.tick(1000);
      expect(s.api.requestCount('GET', '/teams/1')).toBe(1);

      const runsBefore = ref.instance.effectRuns;

      for (const next of [1, 2, 3]) {
        refreshed.set(next);
        s.tick(10);

        expect(s.api.requestCount('GET', '/teams/1')).toBe(1 + next);
      }

      expect(ref.instance.effectRuns).toBe(runsBefore + 3);

      s.tick(5000);

      expect(ref.instance.effectRuns).toBe(runsBefore + 3);
      expect(s.api.requestCount('GET', '/teams/1')).toBe(4);
      expect(s.api.requests.map((request) => request.aborted)).toEqual([false, true, true, false]);
      expect(ref.instance.query()?.rawState).toMatchObject({ response: { id: '1' } });

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('a list refetch tapped after a mutation succeeds', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('archives once and refetches the list once per mutation', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      let campaigns: Campaign[] = [{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }];
      s.api.on('GET', '/campaigns', () => ({ body: [...campaigns], delay: 50 }));
      s.api.on('POST', '/campaigns/:uuid/archive', ({ params }) => {
        campaigns = campaigns.filter((campaign) => campaign.uuid !== params['uuid']);

        return { status: 204, delay: 50 };
      });

      const c = s.consumer([
        { provide: LIST_CAMPAIGNS, useValue: legacy.get<ListCampaignsArgs>('/campaigns') },
        {
          provide: ARCHIVE_CAMPAIGN,
          useValue: legacy.post<ArchiveCampaignArgs>((p) => `/campaigns/${p.uuid}/archive`),
        },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(CampaignsTableHost, c.injector);

      s.tick(1000);
      expect(ref.instance.list()).toEqual([{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }]);

      for (const [index, uuid] of ['a', 'b', 'c'].entries()) {
        ref.instance.archive(uuid);
        s.flush();

        expect(s.api.requestCount('POST', `/campaigns/${uuid}/archive`)).toBe(1);
        expect(s.api.requestCount('GET', '/campaigns')).toBe(2 + index);
        expect(ref.instance.list()).toEqual(campaigns);
        expect(legacy.liveQueries()).toEqual([ref.instance.listQuery()]);
      }

      expect(ref.instance.list()).toEqual([]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('*etInfinityQuery with a failing page', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('shows the error and reports it once', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users', ({ query }) => {
        const page = Number(query['page'] ?? '1');

        return page === 1
          ? { body: { items: [{ id: '1a' }, { id: '1b' }], totalPages: 3 }, delay: 50 }
          : { status: 404, body: { message: 'not found' }, delay: 50 };
      });

      const config = createInfinityQueryConfig({
        queryCreator: legacy.get<{ queryParams: { page: number; limit: number } }>('/users') as never,
        limitParam: { value: 2 },
        response: {
          arrayType: [] as { id: string }[],
          valueExtractor: (response: { items: { id: string }[] }) => response.items,
        },
      });
      const c = s.consumer([{ provide: INFINITY_CONFIG, useValue: config }]);
      const ref = s.mount(InfinityListHost, c.injector);

      s.tick(1000);
      expect(slot(ref, 'items')).toBe('1a,1b');

      (ref.location.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="more"]')?.click();
      s.tick(1000);

      expect(slot(ref, 'error')).toBe('404');
      expect(slot(ref, 'items')).toBe('1a,1b');
      expect(s.api.requestCount('GET', '/users')).toBe(2);
      expectInteropFailureReport(s, kind, 404);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });
});
