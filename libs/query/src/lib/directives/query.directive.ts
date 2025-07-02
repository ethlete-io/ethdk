import {
  ChangeDetectorRef,
  Directive,
  ErrorHandler,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AnyLegacyQuery, isLegacyQuery } from '../experimental/interop/legacy-query';
import {
  AnyQuery,
  AnyQueryCollection,
  QueryCollectionKeysOf,
  QueryOf,
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
import { queryStateSignal } from '../utils';

export type QueryDirectiveContext<Q extends QueryDirectiveType | null> = {
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
};

export type QueryDirectiveType = AnyQuery | AnyLegacyQuery | AnyQueryCollection;

@Directive({
  selector: '[etQuery]',
  standalone: true,
})
export class QueryDirective<Q extends QueryDirectiveType | null> {
  private errorHandler = inject(ErrorHandler);
  private cdr = inject(ChangeDetectorRef);

  private readonly _viewContext: QueryDirectiveContext<Q> = {
    $implicit: null,
    etQuery: null,
    loading: false,
    refreshing: false,
    error: null,
    progress: null,
    scope: null,
    query: null,
  };

  query = input.required<Q>({ alias: 'etQuery' });

  cache = input(false, { alias: 'etQueryCache' });

  queryState = queryStateSignal(this.query);

  static ngTemplateContextGuard<Q extends QueryDirectiveType | null>(
    dir: QueryDirective<Q>,
    ctx: unknown,
  ): ctx is QueryDirectiveContext<Q> {
    return true;
  }

  constructor() {
    inject(ViewContainerRef).createEmbeddedView(inject(TemplateRef), this._viewContext);

    effect(() => {
      const query = extractQuery(this.query());

      untracked(() => {
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

        this._viewContext.scope = isQueryCollection(query) ? (query.type as QueryCollectionKeysOf<Q>) : null;
        this._viewContext.query = query as QueryOf<Q>;
      });
    });

    effect(() => {
      const state = this.queryState();
      const cache = this.cache();

      untracked(() => {
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
        } else if (!cache) {
          this._viewContext.etQuery = null;
          this._viewContext.$implicit = null;
        }

        if (isQueryStateFailure(state)) {
          this._viewContext.error = state.error;

          if (isLegacyQuery(extractQuery(this.query()))) {
            this.errorHandler.handleError(state.error.httpErrorResponse);
          }
        } else {
          this._viewContext.error = null;
        }

        this.cdr.markForCheck();
      });
    });
  }
}
