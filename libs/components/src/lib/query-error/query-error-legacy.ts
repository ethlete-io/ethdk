import { Signal, computed } from '@angular/core';
import {
  AnyLegacyQuery,
  AnyQueryCollection,
  AnyV2Query,
  QueryErrorResponse,
  RequestError,
  createQueryErrorResponse,
  extractQuery,
} from '@ethlete/query';
import { QueryErrorRetryTarget } from './query-error.types';

/**
 * A legacy `RequestError` as the current client's `QueryErrorResponse`.
 *
 * Nearly free, because a legacy error carries the raw `HttpErrorResponse` it came from - so the current
 * client's own normalizer does the classifying, and a legacy error is described by exactly the same code, and
 * judged by the same retry policy, as a current one. That is the point of the adapter: no second
 * classification path to keep in step.
 */
export const queryErrorResponseFromLegacyError = (error: RequestError): QueryErrorResponse =>
  createQueryErrorResponse(error.httpErrorResponse);

export type LegacyQueryErrorSource = {
  /** Bind to `<et-query-error [error]="…">`. */
  error: Signal<QueryErrorResponse | null>;
  /** Re-runs the legacy query, bypassing its cache. */
  retry: () => void;
  /** Bind to `<et-query-error [query]="…">` to have the retry button call `retry` for you. */
  retryTarget: QueryErrorRetryTarget;
};

/**
 * Bridges a legacy query into `<et-query-error>`, so an app still on the V2 client gets the components-lib
 * error UI without the component ever naming a legacy type.
 *
 * A separate adapter rather than a union-typed input - the same split as the select and table query adapters -
 * so the component's API describes one client, and this file is the only thing to delete when the last legacy
 * query is gone.
 *
 * The error is passed in rather than read off the query because legacy query state is an `Observable`, not a
 * signal: how you get from `state$` to a signal is the app's choice (`toSignal`, a store, an `async` pipe
 * feeding an input), and this adapter should not make it for you.
 *
 * @example
 * private legacyUsers = legacyQueryErrorSource({
 *   error: toSignal(this.usersQuery.state$.pipe(map((s) => (isQueryStateFailure(s) ? s.error : null)))),
 *   query: () => this.usersQuery,
 * });
 *
 * // template:
 * @if (legacyUsers.error(); as error) {
 *   <et-query-error [error]="error" [query]="legacyUsers.retryTarget" />
 * }
 */
export const legacyQueryErrorSource = (config: {
  error: () => RequestError | null | undefined;
  query?: () => AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null | undefined;
}): LegacyQueryErrorSource => {
  const error = computed(() => {
    const requestError = config.error();

    return requestError ? queryErrorResponseFromLegacyError(requestError) : null;
  });

  const retry = () => {
    // The legacy client spells cache bypassing `skipCache`; the current one spells it `allowCache: false`.
    extractQuery(config.query?.() ?? null)?.execute({ skipCache: true });
  };

  return { error, retry, retryTarget: { execute: retry } };
};
