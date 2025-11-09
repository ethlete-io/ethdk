import { signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { createProvider } from '@ethlete/core';

export const [provideInfinityQueryResponseDelay, injectInfinityQueryResponseDelay] = createProvider(() => {
  const enabled = signal(false);
  const enabled$ = toObservable(enabled);

  return {
    enabled,
    enabled$,
  };
});
