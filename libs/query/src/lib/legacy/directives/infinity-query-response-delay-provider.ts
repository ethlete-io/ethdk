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

export const provideInfinityQueryResponseDelay = /* @__PURE__ */ toProvideFn(INFINITY_QUERY_RESPONSE_DELAY_DEF);
export const injectInfinityQueryResponseDelay = /* @__PURE__ */ toInjectFn(INFINITY_QUERY_RESPONSE_DELAY_DEF);
