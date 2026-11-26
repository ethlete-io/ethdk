import { ModelSignal } from '@angular/core';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { filter, map, Observable } from 'rxjs';

/**
 * Signal forms mark a custom control's field touched only when the control emits `touch`; they
 * never watch a `touched` model. Wrap the result in `outputFromObservable()` to emit `touch`
 * whenever the control itself sets `touched` to `true`.
 */
export const controlTouches = (touched: ModelSignal<boolean>): Observable<void> =>
  outputToObservable(touched).pipe(
    filter(Boolean),
    map(() => undefined),
  );
