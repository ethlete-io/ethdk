/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ChangeDetectorRef,
  Directive,
  ErrorHandler,
  inject,
  InjectionToken,
  Injector,
  Input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { createDestroy } from '@ethlete/core';
import { BehaviorSubject, combineLatest, Subject, takeUntil, tap, withLatestFrom } from 'rxjs';
import { InfinityQuery, InfinityQueryConfig, InfinityQueryOf } from '../infinite-query';
import { AnyLegacyQueryCreator, isLegacyQuery } from '../interop';
import {
  BaseArguments,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  switchQueryState,
} from '../query';
import { AnyV2QueryCreator, ConstructQuery } from '../query-creator';
import { RequestError } from '../request';
import {
  injectInfinityQueryResponseDelay,
  provideInfinityQueryResponseDelay,
} from './infinity-query-response-delay-provider';

type InfinityQueryContext<
  Q extends InfinityQueryConfig<DirectiveQueryCreator, BaseArguments | undefined, any, unknown[]>,
> = {
  $implicit: Q['response']['arrayType'] | null;
  etInfinityQuery: Q['response']['arrayType'] | null;
  loading: boolean;
  error: RequestError<unknown> | null;

  isFirstLoad: boolean;
  canLoadMore: boolean;
  currentPage: number | null;
  currentCalculatedPage: number | null;
  totalPages: number | null;
  itemsPerPage: number | null;

  currentQuery: ConstructQuery<Q['queryCreator']> | null;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const INFINITY_QUERY_TOKEN = new InjectionToken<InfinityQueryDirective<any>>('INFINITY_QUERY_TOKEN');

type DirectiveQueryCreator = AnyV2QueryCreator | AnyLegacyQueryCreator;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
@Directive({
  selector: '[etInfinityQuery]',
  exportAs: 'etInfinityQuery',

  providers: [
    { provide: INFINITY_QUERY_TOKEN, useExisting: InfinityQueryDirective },
    provideInfinityQueryResponseDelay(),
  ],
})
export class InfinityQueryDirective<
  Q extends InfinityQueryConfig<DirectiveQueryCreator, BaseArguments | undefined, any, unknown[]>,
> {
  private readonly queryConfigChanged$ = new Subject<boolean>();
  private readonly viewContext: InfinityQueryContext<Q> = {
    $implicit: null,
    etInfinityQuery: null,
    loading: false,
    error: null,

    isFirstLoad: false,
    canLoadMore: false,
    currentPage: null,
    currentCalculatedPage: null,
    totalPages: null,
    itemsPerPage: null,

    currentQuery: null,
  };
  private infinityQueryInstance: InfinityQueryOf<Q> | null = null;

  private readonly destroy$ = createDestroy();
  private cdr = inject(ChangeDetectorRef);
  private viewContainerRef = inject(ViewContainerRef);
  private mainTemplateRef = inject(TemplateRef<InfinityQueryContext<Q>>);
  private errorHandler = inject(ErrorHandler);
  private injector = inject(Injector);
  private infinityQueryResponseDelay = injectInfinityQueryResponseDelay({ host: true });

  private readonly _data$ = new BehaviorSubject<Q['response']['arrayType']>([]);

  @Input('etInfinityQuery')
  get infinityQuery(): Q {
    return this._infinityQuery;
  }
  set infinityQuery(v: Q) {
    this.cleanup();

    if (v.enabled === false) {
      this._infinityQuery = v;
      this.infinityQueryInstance = null;

      return;
    }

    this._infinityQuery = v;
    this.infinityQueryInstance = this.setupInfinityQuery(v);
    this.infinityQueryInstance.nextPage();
  }
  private _infinityQuery!: Q;

  get context() {
    return this.viewContext;
  }

  get instance() {
    return this.infinityQueryInstance;
  }

  get data$() {
    return this._data$.asObservable();
  }

  data = toSignal(this._data$, { requireSync: true });

  static ngTemplateContextGuard<
    Q extends InfinityQueryConfig<DirectiveQueryCreator, BaseArguments | undefined, any, unknown[]>,
  >(_dir: InfinityQueryDirective<Q>, _ctx: unknown): _ctx is InfinityQueryContext<Q> {
    return true;
  }

  constructor() {
    this.viewContainerRef.createEmbeddedView(this.mainTemplateRef, this.viewContext);
  }

  private setupInfinityQuery(config: Q) {
    const instance = new InfinityQuery(
      { ...config, injector: config.injector ?? this.injector } as any,
      this.destroy$,
    ) as InfinityQueryOf<Q>;

    combineLatest([
      instance.currentQuery$.pipe(switchQueryState(), withLatestFrom(instance.currentQuery$)),
      this.infinityQueryResponseDelay.enabled$,
      instance.data$,
    ])
      .pipe(
        tap(([[state, currentQuery], isDelayed, infinityArray]) => {
          this.viewContext.currentPage = instance.currentPage;
          this.viewContext.totalPages = instance.totalPages;
          this.viewContext.itemsPerPage = instance.itemsPerPage;
          this.viewContext.canLoadMore =
            (instance.totalPages !== null &&
              instance.currentPage !== null &&
              instance.totalPages > instance.currentPage) ||
            false;
          this.viewContext.currentCalculatedPage = instance.currentCalculatedPage;
          this.viewContext.currentQuery = currentQuery;

          if (isQueryStateLoading(state) || isDelayed || !infinityArray) {
            this.viewContext.loading = state ? state.meta.triggeredVia !== 'poll' : true;
            this.viewContext.error = null;
            this.viewContext.isFirstLoad = this.context.etInfinityQuery === null;
          } else if (isQueryStateFailure(state)) {
            this.viewContext.loading = false;
            this.viewContext.error = state.error;
            this.viewContext.isFirstLoad = false;

            if (isLegacyQuery(currentQuery)) {
              this.errorHandler.handleError(state.error.httpErrorResponse);
            }
          } else if (isQueryStateSuccess(state)) {
            this.viewContext.loading = false;
            this.viewContext.error = null;
            this.viewContext.isFirstLoad = false;
            this.viewContext.etInfinityQuery = this.viewContext.$implicit = infinityArray as Q['response']['arrayType'];
            this._data$.next(infinityArray);
          }

          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
        takeUntil(this.queryConfigChanged$),
      )
      .subscribe();

    return instance;
  }

  loadNextPage() {
    if (!this.infinityQueryInstance) {
      return;
    }

    if (this.viewContext.loading) {
      return;
    }

    this.infinityQueryInstance.nextPage();
  }

  reset(newConfig?: Omit<Q, 'queryCreator' | 'response'>) {
    if (!this.infinityQueryInstance) {
      return;
    }

    this.infinityQueryInstance.reset(newConfig as any);
  }

  private cleanup() {
    this.queryConfigChanged$.next(true);
    this.infinityQueryInstance?.destroy();
    this.infinityQueryInstance = null;

    this.viewContext.loading = false;
    this.viewContext.error = null;
    this.viewContext.etInfinityQuery = null;
    this.viewContext.$implicit = null;

    this.viewContext.isFirstLoad = false;
    this.viewContext.canLoadMore = false;
    this.viewContext.currentPage = null;
    this.viewContext.itemsPerPage = null;
    this.viewContext.totalPages = null;

    this.viewContext.currentQuery = null;

    this._data$.next([]);
  }
}
