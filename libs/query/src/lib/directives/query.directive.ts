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
  AnyQueryCreatorCollection,
  AnyQueryOfCreatorCollection,
  isQuery,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  QueryOf,
  QueryRawResponseType,
  QueryResponseType,
  QueryState,
} from '../query';
import { RequestError } from '../request';

interface QueryContext<Q extends AnyQuery | null> {
  $implicit: QueryResponseType<Q>;
  query: QueryResponseType<Q>;
  raw: QueryRawResponseType<Q>;
  loading: boolean;
  error: RequestError<unknown> | null;
}

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[query]',
  standalone: true,
})
export class QueryDirective<Q extends AnyQuery | AnyQueryOfCreatorCollection<AnyQueryCreatorCollection> | null>
  implements OnInit, OnDestroy
{
  private _isMainViewCreated = false;
  private _subscription: Subscription | null = null;

  private readonly _viewContext: QueryContext<QueryOf<Q>> = {
    $implicit: null as QueryResponseType<QueryOf<Q>>,
    query: null as QueryResponseType<QueryOf<Q>>,
    raw: null as QueryRawResponseType<QueryOf<Q>>,
    loading: false,
    error: null,
  };

  @Input()
  get query(): Q {
    return this._query;
  }
  set query(v: Q) {
    this._query = v;

    this._subscribeToQuery();
  }
  private _query!: Q;

  @Input('queryCache')
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

  static ngTemplateContextGuard<Q extends AnyQuery | AnyQueryOfCreatorCollection<AnyQueryCreatorCollection> | null>(
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
      return;
    }

    const query = isQuery(this.query) ? this.query : this.query.query;

    const sub = query.state$.pipe(tap((state) => this._updateView(state))).subscribe();

    this._subscription = sub;
  }

  private _updateView(state: QueryState) {
    if (isQueryStateLoading(state)) {
      this._viewContext.loading = true;
    } else {
      this._viewContext.loading = false;
    }

    if (isQueryStateSuccess(state)) {
      this._viewContext.query = state.response as QueryResponseType<QueryOf<Q>>;
      this._viewContext.$implicit = state.response as QueryResponseType<QueryOf<Q>>;
      this._viewContext.raw = state.rawResponse as QueryRawResponseType<QueryOf<Q>>;
    } else if (!this.cache) {
      this._viewContext.query = null as QueryResponseType<QueryOf<Q>>;
      this._viewContext.$implicit = null as QueryResponseType<QueryOf<Q>>;
      this._viewContext.raw = null as QueryRawResponseType<QueryOf<Q>>;
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
