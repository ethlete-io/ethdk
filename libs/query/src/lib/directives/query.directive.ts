import {
  ChangeDetectorRef,
  Directive,
  ErrorHandler,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { Subscription, tap } from 'rxjs';
import {
  AnyQuery,
  AnyQueryCollection,
  QueryOf,
  QueryState,
  isQuery,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
} from '../query';
import { QueryDataOf } from '../query-creator';
import { RequestError, RequestProgress } from '../request';

interface QueryContext<Q extends AnyQuery | null> {
  $implicit: QueryDataOf<Q> | null;
  etQuery: QueryDataOf<Q> | null;
  loading: boolean;
  refreshing: boolean;
  progress: RequestProgress | null;
  error: RequestError<unknown> | null;
}

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[etQuery]',
  standalone: true,
})
export class QueryDirective<Q extends AnyQuery | AnyQueryCollection | null> implements OnInit, OnDestroy {
  private _isMainViewCreated = false;
  private _subscription: Subscription | null = null;

  private readonly _viewContext: QueryContext<QueryOf<Q>> = {
    $implicit: null,
    etQuery: null,
    loading: false,
    refreshing: false,
    error: null,
    progress: null,
  };

  @Input('etQuery')
  get query(): Q {
    return this._query;
  }
  set query(v: Q) {
    this._query = v;

    this._subscribeToQuery();
  }
  private _query!: Q;

  @Input('etQueryCache')
  get cache(): boolean {
    return this._cache;
  }
  set cache(v: boolean) {
    this._cache = v;
  }
  private _cache = false;

  constructor(
    private _mainTemplateRef: TemplateRef<QueryContext<QueryOf<Q>>>,
    private _viewContainerRef: ViewContainerRef,
    private _errorHandler: ErrorHandler,
    private _cdr: ChangeDetectorRef,
  ) {}

  static ngTemplateContextGuard<Q extends AnyQuery | AnyQueryCollection | null>(
    dir: QueryDirective<Q>,
    ctx: unknown,
  ): ctx is QueryContext<QueryOf<Q>> {
    return true;
  }

  ngOnInit(): void {
    this._renderMainView();
  }

  ngOnDestroy(): void {
    this._subscription?.unsubscribe();
  }

  private _subscribeToQuery(): void {
    this._subscription?.unsubscribe();
    this._subscription = null;

    if (!this.query) {
      this._viewContext.$implicit = null;
      this._viewContext.etQuery = null;
      this._viewContext.loading = false;
      this._viewContext.refreshing = false;
      this._viewContext.error = null;
      this._viewContext.progress = null;
      return;
    }

    const query = isQuery(this.query) ? this.query : this.query.query;

    const sub = query.state$.pipe(tap((state) => this._updateView(state))).subscribe();

    this._subscription = sub;
  }

  private _updateView(state: QueryState) {
    if (isQueryStateLoading(state)) {
      this._viewContext.loading = true;
      this._viewContext.progress = state.progress ?? null;
      this._viewContext.refreshing = state.meta.triggeredVia === 'auto' || state.meta.triggeredVia === 'poll';
    } else {
      this._viewContext.loading = false;
      this._viewContext.refreshing = false;
      this._viewContext.progress = null;
    }

    if (isQueryStateSuccess(state)) {
      this._viewContext.etQuery = state.response as QueryDataOf<QueryOf<Q>>;
      this._viewContext.$implicit = state.response as QueryDataOf<QueryOf<Q>>;
    } else if (!this.cache) {
      this._viewContext.etQuery = null;
      this._viewContext.$implicit = null;
    }

    if (isQueryStateFailure(state)) {
      this._viewContext.error = state.error;

      this._errorHandler.handleError(state.error);
    } else {
      this._viewContext.error = null;
    }

    this._cdr.markForCheck();
  }

  private _renderMainView(): void {
    if (!this._isMainViewCreated) {
      this._isMainViewCreated = true;
      this._viewContainerRef.createEmbeddedView(this._mainTemplateRef, this._viewContext);
    }
  }
}
