import { AnyLegacyQuery } from '../interop';
import { takeUntilResponse } from '../query';

/**
 * Destroying a legacy query tears down the underlying query's injector, which cancels its request - so
 * a superseded or released query that was not aborted (a mutation the server may already have accepted)
 * is torn down only once it has settled. `state$` completes with the query, so this ends either way.
 */
export const destroyOnceSettled = (query: AnyLegacyQuery) => {
  query.state$.pipe(takeUntilResponse()).subscribe({ complete: () => query.destroy() });
};
