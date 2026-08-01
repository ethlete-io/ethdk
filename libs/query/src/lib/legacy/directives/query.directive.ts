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
import { AnyLegacyQuery, isLegacyQuery } from '../interop';
import {
  AnyQueryCollection,
  AnyV2Query,
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

export type QueryDirectiveType = AnyV2Query | AnyLegacyQuery | AnyQueryCollection;

@Directive({
  selector: '[etQuery]',
})
export class QueryDirective<Q extends QueryDirectiveType | null> {
  private errorHandler = inject(ErrorHandler);
  private cdr = inject(ChangeDetectorRef);

  private readonly viewContext: QueryDirectiveContext<Q> = {
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
    _dir: QueryDirective<Q>,
    _ctx: unknown,
  ): _ctx is QueryDirectiveContext<Q> {
    return true;
  }

  constructor() {
    inject(ViewContainerRef).createEmbeddedView(inject(TemplateRef), this.viewContext);

    effect(() => {
      const query = extractQuery(this.query());

      untracked(() => {
        if (!query) {
          this.viewContext.$implicit = null;
          this.viewContext.etQuery = null;
          this.viewContext.loading = false;
          this.viewContext.refreshing = false;
          this.viewContext.error = null;
          this.viewContext.progress = null;
          this.viewContext.scope = null;
          this.viewContext.query = null;

          return;
        }

        if (isQueryStatePrepared(query.rawState) || isQueryStateCancelled(query.rawState)) {
          query.execute();
        }

        this.viewContext.scope = isQueryCollection(query) ? (query.type as QueryCollectionKeysOf<Q>) : null;
        this.viewContext.query = query as QueryOf<Q>;
      });
    });

    effect(() => {
      const state = this.queryState();
      const cache = this.cache();

      untracked(() => {
        if (isQueryStateLoading(state)) {
          this.viewContext.progress = state.progress ?? null;
          this.viewContext.refreshing = state.meta.triggeredVia === 'auto' || state.meta.triggeredVia === 'poll';

          if (!this.viewContext.refreshing) {
            this.viewContext.loading = true;
          }
        } else {
          this.viewContext.loading = false;
          this.viewContext.refreshing = false;
          this.viewContext.progress = null;
        }

        if (isQueryStateSuccess(state)) {
          this.viewContext.etQuery = state.response as QueryDataOf<QueryOf<Q>>;
          this.viewContext.$implicit = state.response as QueryDataOf<QueryOf<Q>>;
        } else if (!cache) {
          this.viewContext.etQuery = null;
          this.viewContext.$implicit = null;
        }

        if (isQueryStateFailure(state)) {
          this.viewContext.error = state.error;

          if (isLegacyQuery(extractQuery(this.query()))) {
            this.errorHandler.handleError(state.error.httpErrorResponse);
          }
        } else {
          this.viewContext.error = null;
        }

        this.cdr.markForCheck();
      });
    });
  }
}
