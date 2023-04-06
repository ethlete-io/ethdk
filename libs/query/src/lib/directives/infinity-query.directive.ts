/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ChangeDetectorRef,
  Directive,
  ErrorHandler,
  inject,
  InjectionToken,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { DelayableDirective, DestroyService } from '@ethlete/core';
import { BehaviorSubject, combineLatest, skip, Subject, takeUntil, tap } from 'rxjs';
import { InfinityQuery, InfinityQueryConfig, InfinityQueryOf } from '../infinite-query';
import {
  BaseArguments,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  switchQueryState,
} from '../query';
import { AnyQueryCreator } from '../query-creator';
import { RequestError } from '../request';

interface InfinityQueryContext<
  Q extends InfinityQueryConfig<AnyQueryCreator, BaseArguments | undefined, any, unknown[]>,
> {
  $implicit: Q['response']['arrayType'] | null;
  infinityQuery: Q['response']['arrayType'] | null;
  loading: boolean;
  error: RequestError<unknown> | null;

  isFirstLoad: boolean;
  canLoadMore: boolean;
  currentPage: number | null;
  currentCalculatedPage: number | null;
  totalPages: number | null;
  itemsPerPage: number | null;
}

export const INFINITY_QUERY_TOKEN = new InjectionToken<InfinityQueryDirective<any>>('INFINITY_QUERY_TOKEN');

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[infinityQuery]',
  exportAs: 'infinityQuery',
  standalone: true,
  providers: [{ provide: INFINITY_QUERY_TOKEN, useExisting: InfinityQueryDirective }, DestroyService],
  hostDirectives: [DelayableDirective],
})
export class InfinityQueryDirective<
  Q extends InfinityQueryConfig<AnyQueryCreator, BaseArguments | undefined, any, unknown[]>,
> implements OnInit, OnDestroy
{
  private readonly _queryConfigChanged$ = new Subject<boolean>();
  private readonly _viewContext: InfinityQueryContext<Q> = {
    $implicit: null,
    infinityQuery: null,
    loading: false,
    error: null,

    isFirstLoad: false,
    canLoadMore: false,
    currentPage: null,
    currentCalculatedPage: null,
    totalPages: null,
    itemsPerPage: null,
  };
  private _infinityQueryInstance: InfinityQueryOf<Q> | null = null;

  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;
  private readonly _cdr = inject(ChangeDetectorRef);
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _mainTemplateRef = inject(TemplateRef<InfinityQueryContext<Q>>);
  private readonly _errorHandler = inject(ErrorHandler);
  private readonly _delayable = inject(DelayableDirective, { host: true });

  private readonly _data$ = new BehaviorSubject<Q['response']['arrayType']>([]);

  private _didReceiveFirstData$ = new BehaviorSubject(false);
  private _isMainViewCreated = false;

  @Input()
  get infinityQuery(): Q {
    return this._infinityQuery;
  }
  set infinityQuery(v: Q) {
    this._cleanup();

    this._infinityQuery = v;
    this._infinityQueryInstance = this._setupInfinityQuery(v);
    this.loadNextPage();
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

  get data() {
    return this._data$.getValue();
  }

  static ngTemplateContextGuard<
    Q extends InfinityQueryConfig<AnyQueryCreator, BaseArguments | undefined, any, unknown[]>,
  >(dir: InfinityQueryDirective<Q>, ctx: unknown): ctx is InfinityQueryContext<Q> {
    return true;
  }

  ngOnInit(): void {
    this._renderMainView();
  }

  ngOnDestroy(): void {
    this.instance?._clearSubscriptions();
  }

  private _setupInfinityQuery(config: Q) {
    const instance = new InfinityQuery(config) as InfinityQueryOf<Q>;

    combineLatest([
      instance.currentQuery$.pipe(switchQueryState()),
      this._delayable.isDelayed$,
      this._didReceiveFirstData$,
    ])
      .pipe(
        tap(([state, isDelayed, didReceiveFirstData]) => {
          this._viewContext.currentPage = instance.currentPage;
          this._viewContext.totalPages = instance.totalPages;
          this._viewContext.itemsPerPage = instance.itemsPerPage;
          this._viewContext.canLoadMore =
            (instance.totalPages && instance.currentPage && instance.totalPages > instance.currentPage) || false;
          this._viewContext.currentCalculatedPage = instance.currentCalculatedPage;

          if (isQueryStateLoading(state) || isDelayed || (!didReceiveFirstData && isQueryStateSuccess(state))) {
            this._viewContext.loading = true;
            this._viewContext.error = null;
            this._viewContext.isFirstLoad = this.context.infinityQuery === null;
          } else if (isQueryStateFailure(state)) {
            this._viewContext.loading = false;
            this._viewContext.error = state.error;
            this._viewContext.isFirstLoad = false;
            this._errorHandler.handleError(state.error);
          } else if (isQueryStateSuccess(state)) {
            this._viewContext.loading = false;
            this._viewContext.error = null;
            this._viewContext.isFirstLoad = false;
          } else {
            this._viewContext.loading = false;
            this._viewContext.error = null;
            this._viewContext.infinityQuery = null;
            this._viewContext.$implicit = null;

            this._viewContext.isFirstLoad = false;
            this._viewContext.canLoadMore = false;
            this._viewContext.currentPage = null;
            this._viewContext.itemsPerPage = null;
            this._viewContext.totalPages = null;

            this._data$.next([]);
          }

          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$),
        takeUntil(this._queryConfigChanged$),
      )
      .subscribe();

    instance.data$
      .pipe(
        skip(1),
        tap((data) => {
          this._viewContext.infinityQuery = this._viewContext.$implicit = data as Q['response']['arrayType'] | null;
          this._data$.next(data);

          if (!this._didReceiveFirstData$.getValue()) {
            this._didReceiveFirstData$.next(true);
          }

          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$),
        takeUntil(this._queryConfigChanged$),
      )
      .subscribe();

    return instance;
  }

  /**
   * @deprecated Use `loadNextPage` instead
   * @breaking 3.0.0
   */
  _loadNextPage() {
    this.loadNextPage();
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

  private _renderMainView(): void {
    if (!this._isMainViewCreated) {
      this._isMainViewCreated = true;
      this._viewContainerRef.createEmbeddedView(this._mainTemplateRef, this._viewContext);
    }
  }

  private _cleanup() {
    this._queryConfigChanged$.next(true);

    this.instance?._clearSubscriptions();

    this._viewContext.loading = false;
    this._viewContext.error = null;
    this._viewContext.infinityQuery = null;
    this._viewContext.$implicit = null;

    this._viewContext.isFirstLoad = false;
    this._viewContext.canLoadMore = false;
    this._viewContext.currentPage = null;
    this._viewContext.itemsPerPage = null;
    this._viewContext.totalPages = null;

    this._data$.next([]);
  }
}
