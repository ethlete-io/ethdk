import { AsyncPipe, JsonPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  TrackByFunction,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { createDestroy, nextFrame } from '@ethlete/core';
import { BehaviorSubject, map, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { BasicAuthProvider, CustomHeaderAuthProvider, isBearerAuthProvider } from '../../../auth';
import { QueryDirective } from '../../../directives';
import { EntityStore } from '../../../entity';
import { AnyQuery, isGqlQueryConfig } from '../../../query';
import { QueryShortNamePipe } from '../../pipes';
import { QUERY_CLIENT_DEVTOOLS_TOKEN, QueryClientDevtoolsOptions } from '../../utils';

type QueryDevtoolsSnapLayout = 'full' | 'left' | 'right' | 'bottom' | 'top';
type QueryListMode = 'live' | 'history';
type QueryViewMode = 'query' | 'authProvider';

@Component({
  selector: 'et-query-devtools',
  templateUrl: './query-devtools.component.html',
  styleUrls: ['./query-devtools.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  host: {
    class: 'et-query-devtools',
  },
  imports: [AsyncPipe, JsonPipe, ReactiveFormsModule, NgClass, QueryShortNamePipe, QueryDirective],
})
export class QueryDevtoolsComponent {
  private readonly _cdr = inject(ChangeDetectorRef);
  protected readonly _destroy$ = createDestroy();

  protected readonly queryClientConfigs = inject(QUERY_CLIENT_DEVTOOLS_TOKEN);

  protected readonly isOpen = signal(false);
  protected readonly isTranslucent = signal(false);
  protected readonly snapLayout = signal<QueryDevtoolsSnapLayout>('full');
  protected readonly queryListMode = signal<QueryListMode>('live');
  protected readonly viewMode = signal<QueryViewMode>('query');

  protected showResponse = signal(false);
  protected showRawResponse = signal(false);
  protected showQueryConfig = signal(false);
  protected showEntityStoreValue = signal(false);
  protected showArguments = signal(false);

  protected selectedClientIdCtrl = new FormControl(0);

  protected readonly selectedClientId = toSignal(
    this.selectedClientIdCtrl.valueChanges.pipe(startWith(this.selectedClientIdCtrl.value)),
  );
  protected readonly selectedQueryId = signal<number | null>(null);

  protected readonly selectedClientConfig = computed(() => {
    if (this.queryClientConfigs.length === 1) {
      return this.queryClientConfigs[0]!;
    }

    const index = this.selectedClientId() ?? 0;

    const cfg = this.queryClientConfigs[index];

    if (!cfg) {
      return this.queryClientConfigs[0]!;
    }

    return cfg;
  });

  protected readonly queryStore = computed(() => {
    const config = this.selectedClientConfig();

    return config.client._store;
  });

  protected readonly queryStore$ = toObservable(this.queryStore);

  private readonly _queries$ = new BehaviorSubject<AnyQuery[]>([]);
  protected readonly queries = toSignal(this._queries$);

  protected readonly selectedQuery = computed(() => {
    const id = this.selectedQueryId();
    const mode = this.queryListMode();

    if (id === null || !mode) {
      return null;
    }

    if (mode === 'live') {
      return this.queries()?.find((q) => q._id === id) ?? null;
    }

    return this.queryHistory$.getValue()?.find((q) => q._id === id) ?? null;
  });

  protected readonly selectedQuery$ = toObservable(this.selectedQuery);

  protected selectedQueryEntityStore = computed(() => {
    const query = this.selectedQuery();

    if (!query) return null;

    return query.store as EntityStore<unknown> | null;
  });

  protected readonly selectedQueryEntityStore$ = toObservable(this.selectedQueryEntityStore);

  protected readonly selectedQueryEntityStoreValue$ = this.selectedQueryEntityStore$.pipe(
    switchMap(
      (s) =>
        s?._change$.pipe(
          startWith(''),
          map(() => {
            if (!s._dictionary) return null;

            return Array.from(s._dictionary).reduce(
              (obj, [key, value]) => {
                obj[key] = value;
                return obj;
              },
              {} as Record<string, unknown>,
            );
          }),
        ) ?? of(null),
    ),
  );

  protected readonly queryHistory$ = new BehaviorSubject<AnyQuery[]>([]);

  protected readonly stringifiedQueryConfig = computed(() => {
    const query = this.selectedQuery();

    if (!query) return null;

    const cfg = query._queryConfig;
    const route =
      typeof cfg.route === 'string' ? cfg.route : cfg.route ? cfg.route({}).replace(/undefined/g, ':param') : null;

    const sharedCfg = {
      method: cfg.method,
      secure: cfg.secure,
      route,
      reportProgress: cfg.reportProgress,
      responseType: cfg.responseType,
      withCredentials: cfg.withCredentials,
      autoRefreshOn: cfg.autoRefreshOn,
      enableSmartPolling: cfg.enableSmartPolling,
      hasEntityStore: !!cfg.entity,
    };

    if (isGqlQueryConfig(cfg)) {
      return {
        ...sharedCfg,
        query: cfg.query,
        transferVia: cfg.transferVia,
      };
    }

    return {
      ...sharedCfg,
    };
  });

  protected readonly authProvider = toSignal(
    toObservable(this.selectedClientConfig).pipe(switchMap((c) => c.client.authProvider$)),
  );

  protected readonly authProviderDetails = computed(() => {
    const provider = this.authProvider();

    if (!provider) return null;

    if (provider instanceof CustomHeaderAuthProvider) {
      return {
        type: 'CustomHeaderAuthProvider',
        header: () => provider.header,
        provider: provider,
        config: {
          name: provider._config.name,
          value: provider._config.value,
        },
      } as const;
    } else if (provider instanceof BasicAuthProvider) {
      return {
        type: 'BasicAuthProvider',
        header: () => provider.header,
        provider: provider,
        config: {
          username: provider._config.username,
          password: provider._config.password,
        },
      } as const;
    } else if (isBearerAuthProvider(provider)) {
      const refreshCfg = provider._config.refreshConfig;

      return {
        type: 'BearerAuthProvider',
        header: () => provider.header,
        provider: provider,
        config: {
          token: provider._config.token,
          refreshConfig: {
            refreshOnUnauthorizedResponse: refreshCfg?.refreshOnUnauthorizedResponse ?? 'true (default)',
            token: refreshCfg?.token,
            cookieName: refreshCfg?.cookieName,
            cookieDomain: refreshCfg?.cookieDomain ?? 'current origin (default)',
            cookieExpiresInDays: refreshCfg?.cookieExpiresInDays ?? '30 (default)',
            cookiePath: refreshCfg?.cookiePath ?? '/ (default)',
            cookieEnabled: refreshCfg?.cookieEnabled ?? 'true (default)',
            cookieSameSite: refreshCfg?.cookieSameSite ?? 'lax (default)',
            refreshBuffer: refreshCfg?.refreshBuffer ?? '30000 (default)',
            expiresInPropertyName: refreshCfg?.expiresInPropertyName ?? 'exp (default)',
            strategy: refreshCfg?.strategy ?? 'AuthBearerRefreshStrategy.BeforeExpiration (default)',
            requestArgsAdapter: refreshCfg?.requestArgsAdapter ? 'custom' : 'default',
            responseAdapter: refreshCfg?.responseAdapter ? 'custom' : 'default',
          },
        },
      } as const;
    } else {
      return {
        type: 'UnknownAuthProvider',
        header: () => provider.header,
        provider: provider,
        config: {},
      } as const;
    }
  });

  constructor() {
    this.selectedClientIdCtrl.valueChanges
      .pipe(
        tap(() => this.clearQueryHistory()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this.selectedQuery$
      .pipe(
        switchMap((q) => q?._dependentsChanged$ ?? of(null)),
        tap(() => this._cdr.markForCheck()),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.authProviderDetails)
      .pipe(switchMap((ap) => (ap?.type === 'BearerAuthProvider' ? ap.provider.tokens$ : of(null))))
      .pipe(
        tap(() => this._cdr.markForCheck()),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.queryStore$
      .pipe(
        switchMap((s) =>
          s.storeChange$.pipe(
            startWith(''),
            map(() => s._store),
            tap((s) => {
              untracked(() => {
                this._queries$.next(Array.from(s.values()));
              });
            }),
            takeUntil(this._destroy$),
          ),
        ),
      )
      .subscribe();

    this.queryStore$
      .pipe(
        switchMap((s) =>
          s.queryCreated$.pipe(
            tap((query) => {
              const currentHistory = this.queryHistory$.getValue();

              if (!currentHistory) return;

              const currentHistoryClone = [...currentHistory];

              if (!currentHistory.some((q) => q._id === query._id)) {
                currentHistoryClone.unshift(query);
              }

              currentHistoryClone.splice(50);

              this.queryHistory$.next(currentHistoryClone);
            }),
            takeUntil(this._destroy$),
          ),
        ),
      )
      .subscribe();

    this._queries$
      .pipe(
        tap((queries) => {
          const currentHistory = this.queryHistory$.getValue();

          if (!queries || !currentHistory) return;

          const currentHistoryClone = [...currentHistory];

          for (const query of queries) {
            if (!currentHistoryClone.some((q) => q._id === query._id)) {
              currentHistoryClone.unshift(query);
            }
          }

          currentHistoryClone.splice(50);

          this.queryHistory$.next(currentHistoryClone);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    effect(() => {
      const devtoolConfig = {
        isOpen: this.isOpen(),
        isTranslucent: this.isTranslucent(),
        snapLayout: this.snapLayout(),
        showResponse: this.showResponse(),
        showRawResponse: this.showRawResponse(),
        showQueryConfig: this.showQueryConfig(),
        showEntityStoreValue: this.showEntityStoreValue(),
        showArguments: this.showArguments(),
        selectedClientId: this.selectedClientId(),
        selectedQueryPath: this.selectedQueryId(),
        queryListMode: this.queryListMode(),
        viewMode: this.viewMode(),
      };

      window.localStorage.setItem('ethlete:query:devtools', JSON.stringify(devtoolConfig));
    });

    const initialConfig = window.localStorage.getItem('ethlete:query:devtools');

    if (initialConfig) {
      const parsed = JSON.parse(initialConfig);

      this.isOpen.set(parsed.isOpen ?? false);
      this.isTranslucent.set(parsed.isTranslucent ?? false);
      this.snapLayout.set(parsed.snapLayout ?? 'full');
      this.showResponse.set(parsed.showResponse ?? false);
      this.showRawResponse.set(parsed.showRawResponse ?? false);
      this.showQueryConfig.set(parsed.showQueryConfig ?? false);
      this.showEntityStoreValue.set(parsed.showEntityStoreValue ?? false);
      this.showArguments.set(parsed.showArguments ?? false);
      this.selectedClientIdCtrl.setValue(parsed.selectedClientId ?? 0);
      this.selectedQueryId.set(parsed.selectedQueryPath ?? null);
      this.queryListMode.set(parsed.queryListMode ?? 'live');
      this.viewMode.set(parsed.viewMode ?? 'query');
    }
  }

  protected trackByClient: TrackByFunction<QueryClientDevtoolsOptions> = (_, { client }) => client.config.baseRoute;
  protected trackByQuery: TrackByFunction<AnyQuery> = (_, { _id }) => _id;

  protected toggleOpen() {
    this.isOpen.set(!this.isOpen());
  }

  protected toggleTranslucent() {
    this.isTranslucent.set(!this.isTranslucent());
  }

  protected toggleShowResponse() {
    this.showResponse.set(!this.showResponse());

    nextFrame(() => {
      this._cdr.markForCheck();
    });
  }

  protected toggleShowQueryConfig() {
    this.showQueryConfig.set(!this.showQueryConfig());
  }

  protected toggleShowRawResponse() {
    this.showRawResponse.set(!this.showRawResponse());
  }

  protected toggleShowEntityStoreValue() {
    this.showEntityStoreValue.set(!this.showEntityStoreValue());
  }

  protected toggleShowArguments() {
    this.showArguments.set(!this.showArguments());
  }

  protected selectSnapLayout(layout: QueryDevtoolsSnapLayout) {
    this.snapLayout.set(layout);
  }

  protected selectQueryListMode(mode: QueryListMode) {
    this.queryListMode.set(mode);
  }

  protected selectViewMode(mode: QueryViewMode) {
    this.viewMode.set(mode);
  }

  protected selectQuery(query: AnyQuery) {
    this.selectedQueryId.set(query._id);
  }

  protected clearQueryHistory() {
    this.queryHistory$.next([]);
  }
}
