import { Injector, assertInInjectionContext, effect } from '@angular/core';
import { QueryErrorResponse, isSymfonyPagerfantaOutOfRangeError } from '../http';
import { QueryFormFields, QueryFormModel } from './query-form-signals.types';
import { QueryFormSignals } from './query-form-signals';

/** An out-of-range page reports HTTP 416, or 500 with a Pagerfanta out-of-range detail in dev. */
const isPageOutOfRangeError = (error: QueryErrorResponse): boolean => {
  if (error.code === 416) return true;

  return error.code === 500 && isSymfonyPagerfantaOutOfRangeError(error.raw.error);
};

export type ResetPageOnQueryErrorConfig<TFields extends QueryFormFields> = {
  /**
   * The query's `error` signal (e.g. `query.error`), or a computed reading the
   * error of a dynamic query (`() => currentQuery()?.error() ?? null`).
   */
  readonly error: () => QueryErrorResponse | null;

  /** The query form whose page field to reset to its default when the page is out of range. */
  readonly queryForm: QueryFormSignals<TFields>;

  /**
   * The field that holds the page number.
   * @default 'page'
   */
  readonly pageField?: keyof QueryFormModel<TFields>;

  /** Injector to use when not called in an injection context. */
  readonly injector?: Injector;
};

/**
 * The signals-native counterpart to the legacy RxJS `resetPageOnError`. Watches a
 * query's `error` signal and resets the query form's page field to its default
 * whenever the current page is out of range (HTTP 416, or a 500 Pagerfanta
 * out-of-range error in dev) — e.g. after filters shrink the result set below the
 * current page. Must be called in an injection context unless an `injector` is given.
 *
 * @example
 * const users = getUsers({ args: () => ({ queryParams: qf.value() }) });
 * resetPageOnQueryError({ error: users.error, queryForm: qf });
 */
export const resetPageOnQueryError = <TFields extends QueryFormFields>(
  config: ResetPageOnQueryErrorConfig<TFields>,
): void => {
  if (!config.injector) {
    assertInInjectionContext(resetPageOnQueryError);
  }

  const pageField = (config.pageField ?? 'page') as keyof QueryFormModel<TFields>;

  effect(
    () => {
      const error = config.error();

      if (!error || !isPageOutOfRangeError(error)) return;

      config.queryForm.resetFieldToDefault(pageField);
    },
    { injector: config.injector },
  );
};
