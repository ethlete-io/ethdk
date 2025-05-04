import {
  ChangeDetectorRef,
  Directive,
  ErrorHandler,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subscription, tap } from 'rxjs';
import { AnyLegacyQuery } from '../experimental';
import {
  AnyQuery,
  AnyQueryCollection,
  QueryCollectionKeysOf,
  QueryOf,
  QueryState,
  extractQuery,
  isQueryCollection,
  isQueryStateCancelled,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStatePrepared,
  isQueryStateSuccess,
} from '../query';
import { QueryDataOf } from '../query-creator';
import { RequestError, RequestProgress } from '../request';

interface QueryContext<Q extends AnyQuery | AnyLegacyQuery | AnyQueryCollection | null> {
  /**
   * The queries's response data.
   */
  $implicit: QueryDataOf<QueryOf<Q>> | null;

  /**
   * The queries's response data.
   */
  etQuery: QueryDataOf<QueryOf<Q>> | null;

  /**
   * The query used inside this directive. Useful if for instance the query gets unwrapped via async pipe inside the directive.
   */
  query: QueryOf<Q> | null;

  /**
   * Is true when the query is triggered by user interaction.
   */
  loading: boolean;

  /**
   * Is true when the query is triggered by either polling or auto refresh event.
   */
  refreshing: boolean;

  /**
   * The query's progress state.
   */
  progress: RequestProgress | null;

  /**
   * The query's error state.
   */
  error: RequestError<unknown> | null;

  /**
   * The query's scope (only available when the query is a collection)
   */
  scope: QueryCollectionKeysOf<Q> | null;
}

@Directive({
  selector: '[etQuery]',
  standalone: true,
})
export class QueryDirective<Q extends AnyQuery | AnyLegacyQuery | AnyQueryCollection | null>
  implements OnInit, OnDestroy
{
  private _mainTemplateRef = inject<TemplateRef<QueryContext<Q>>>(TemplateRef);
  private _viewContainerRef = inject(ViewContainerRef);
  private _errorHandler = inject(ErrorHandler);
  private _cdr = inject(ChangeDetectorRef);

  private _isMainViewCreated = false;
  private _subscription: Subscription | null = null;

  private readonly _viewContext: QueryContext<Q> = {
    $implicit: null,
    etQuery: null,
    loading: false,
    refreshing: false,
    error: null,
    progress: null,
    scope: null,
    query: null,
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

  static ngTemplateContextGuard<Q extends AnyQuery | AnyLegacyQuery | AnyQueryCollection | null>(
    dir: QueryDirective<Q>,
    ctx: unknown,
  ): ctx is QueryContext<Q> {
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

    const query = extractQuery(this.query);

    if (!query) {
      this._viewContext.$implicit = null;
      this._viewContext.etQuery = null;
      this._viewContext.loading = false;
      this._viewContext.refreshing = false;
      this._viewContext.error = null;
      this._viewContext.progress = null;
      this._viewContext.scope = null;
      this._viewContext.query = null;
      return;
    }

    if (isQueryStatePrepared(query.rawState) || isQueryStateCancelled(query.rawState)) {
      query.execute();
    }

    const sub = query.state$.pipe(tap((state) => this._updateView(state))).subscribe();

    this._viewContext.scope = isQueryCollection(query) ? (query.type as QueryCollectionKeysOf<Q>) : null;
    this._viewContext.query = query as QueryOf<Q>;

    this._subscription = sub;
  }

  private _updateView(state: QueryState) {
    if (isQueryStateLoading(state)) {
      this._viewContext.progress = state.progress ?? null;
      this._viewContext.refreshing = state.meta.triggeredVia === 'auto' || state.meta.triggeredVia === 'poll';

      if (!this._viewContext.refreshing) {
        this._viewContext.loading = true;
      }
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
