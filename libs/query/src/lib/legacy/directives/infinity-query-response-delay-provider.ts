import { signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';

const INFINITY_QUERY_RESPONSE_DELAY_DEF = /* @__PURE__ */ defineProvider(
  () => {
    const enabled = signal(false);
    const enabled$ = toObservable(enabled);

    return {
      enabled,
      enabled$,
    };
  },
  { name: 'Infinity Query Response Delay' },
);

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const provideInfinityQueryResponseDelay = /* @__PURE__ */ toProvideFn(INFINITY_QUERY_RESPONSE_DELAY_DEF);
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const injectInfinityQueryResponseDelay = /* @__PURE__ */ toInjectFn(INFINITY_QUERY_RESPONSE_DELAY_DEF);
