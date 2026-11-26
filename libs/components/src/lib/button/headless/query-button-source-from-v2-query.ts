import { Signal, computed } from '@angular/core';
import { AnyLegacyQuery, AnyQueryCollection, AnyV2Query, isQueryStateLoading, queryStateSignal } from '@ethlete/query';
import { QueryButtonSource } from './query-button.directive';

/**
 * Builds an `etQueryButton` source from a **legacy v2** query, a `createLegacyQueryCreator` query or a
 * query collection. Call it in an injection context (a field initializer or constructor).
 *
 * @example
 * protected deleteSource = queryButtonSourceFromV2Query(this.deleteQuery);
 */
export const queryButtonSourceFromV2Query = (
  query: Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>,
): QueryButtonSource => {
  const state = queryStateSignal(query);

  return {
    loading: computed(() => {
      const current = state();

      return isQueryStateLoading(current) ? { progress: current.progress ?? null } : null;
    }),
  };
};
