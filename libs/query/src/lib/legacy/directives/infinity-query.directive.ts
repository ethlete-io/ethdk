/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ChangeDetectorRef,
  Directive,
  ErrorHandler,
  inject,
  InjectionToken,
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

interface InfinityQueryContext<
  Q extends InfinityQueryConfig<DirectiveQueryCreator, BaseArguments | undefined, any, unknown[]>,
> {
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
}

export const INFINITY_QUERY_TOKEN = new InjectionToken<InfinityQueryDirective<any>>('INFINITY_QUERY_TOKEN');

type DirectiveQueryCreator = AnyV2QueryCreator | AnyLegacyQueryCreator;

@Directive({
  selector: '[etInfinityQuery]',
  exportAs: 'etInfinityQuery',
  standalone: true,
  providers: [
    { provide: INFINITY_QUERY_TOKEN, useExisting: InfinityQueryDirective },
    provideInfinityQueryResponseDelay(),
  ],
})
export class InfinityQueryDirective<
  Q extends InfinityQueryConfig<DirectiveQueryCreator, BaseArguments | undefined, any, unknown[]>,
> {
  private readonly _queryConfigChanged$ = new Subject<boolean>();
  private readonly _viewContext: InfinityQueryContext<Q> = {
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
  private _infinityQueryInstance: InfinityQueryOf<Q> | null = null;

  private readonly _destroy$ = createDestroy();
  private readonly _cdr = inject(ChangeDetectorRef);
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _mainTemplateRef = inject(TemplateRef<InfinityQueryContext<Q>>);
  private readonly _errorHandler = inject(ErrorHandler);
  private readonly _infinityQueryResponseDelay = injectInfinityQueryResponseDelay({ host: true });

  private readonly _data$ = new BehaviorSubject<Q['response']['arrayType']>([]);

  @Input('etInfinityQuery')
  get infinityQuery(): Q {
    return this._infinityQuery;
  }
  set infinityQuery(v: Q) {
    this._cleanup();

    this._infinityQuery = v;
    this._infinityQueryInstance = this._setupInfinityQuery(v);
    this._infinityQueryInstance.nextPage();
  }
  private _infinityQuery!: Q;

  get context() {
    return this._viewContext;
  }

  get instance() {
    return this._infinityQueryInstance;
  }

  get data$() {
    return this._data$.asObservable();
  }

  data = toSignal(this._data$, { requireSync: true });

  static ngTemplateContextGuard<
    Q extends InfinityQueryConfig<DirectiveQueryCreator, BaseArguments | undefined, any, unknown[]>,
  >(dir: InfinityQueryDirective<Q>, ctx: unknown): ctx is InfinityQueryContext<Q> {
    return true;
  }

  constructor() {
    this._viewContainerRef.createEmbeddedView(this._mainTemplateRef, this._viewContext);
  }

  private _setupInfinityQuery(config: Q) {
    const instance = new InfinityQuery(config, this._destroy$) as InfinityQueryOf<Q>;

    combineLatest([
      instance.currentQuery$.pipe(switchQueryState(), withLatestFrom(instance.currentQuery$)),
      this._infinityQueryResponseDelay.enabled$,
      instance.data$,
    ])
      .pipe(
        tap(([[state, currentQuery], isDelayed, infinityArray]) => {
          this._viewContext.currentPage = instance.currentPage;
          this._viewContext.totalPages = instance.totalPages;
          this._viewContext.itemsPerPage = instance.itemsPerPage;
          this._viewContext.canLoadMore =
            (instance.totalPages !== null &&
              instance.currentPage !== null &&
              instance.totalPages > instance.currentPage) ||
            false;
          this._viewContext.currentCalculatedPage = instance.currentCalculatedPage;
          this._viewContext.currentQuery = currentQuery;

          if (isQueryStateLoading(state) || isDelayed || !infinityArray) {
            this._viewContext.loading = state ? state.meta.triggeredVia !== 'poll' : true;
            this._viewContext.error = null;
            this._viewContext.isFirstLoad = this.context.etInfinityQuery === null;
          } else if (isQueryStateFailure(state)) {
            this._viewContext.loading = false;
            this._viewContext.error = state.error;
            this._viewContext.isFirstLoad = false;

            if (isLegacyQuery(currentQuery)) {
              this._errorHandler.handleError(state.error.httpErrorResponse);
            }
          } else if (isQueryStateSuccess(state)) {
            this._viewContext.loading = false;
            this._viewContext.error = null;
            this._viewContext.isFirstLoad = false;
            this._viewContext.etInfinityQuery = this._viewContext.$implicit =
              infinityArray as Q['response']['arrayType'];
            this._data$.next(infinityArray);
          }

          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$),
        takeUntil(this._queryConfigChanged$),
      )
      .subscribe();

    return instance;
  }

  loadNextPage() {
    if (!this._infinityQueryInstance) {
      return;
    }

    if (this._viewContext.loading) {
      return;
    }

    this._infinityQueryInstance.nextPage();
  }

  reset(newConfig?: Omit<Q, 'queryCreator' | 'response'>) {
    if (!this._infinityQueryInstance) {
      return;
    }

    this._infinityQueryInstance.reset(newConfig as any);
  }

  private _cleanup() {
    this._queryConfigChanged$.next(true);

    this._viewContext.loading = false;
    this._viewContext.error = null;
    this._viewContext.etInfinityQuery = null;
    this._viewContext.$implicit = null;

    this._viewContext.isFirstLoad = false;
    this._viewContext.canLoadMore = false;
    this._viewContext.currentPage = null;
    this._viewContext.itemsPerPage = null;
    this._viewContext.totalPages = null;

    this._viewContext.currentQuery = null;

    this._data$.next([]);
  }
}
