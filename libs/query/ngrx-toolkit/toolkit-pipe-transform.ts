import { ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export type CreateToolkitPipeTransformOptions<TValue, TState> = {
  initialState: TState;
  disposedState: TState;
  state$: (value: TValue) => Observable<TState>;
};

export const createToolkitPipeTransform = <TValue extends object, TState>(
  options: CreateToolkitPipeTransformOptions<TValue, TState>,
) => {
  const cdr = inject(ChangeDetectorRef);
  let subscription = Subscription.EMPTY;
  let current: TValue | null = null;
  let state = options.initialState;

  const dispose = () => {
    subscription.unsubscribe();
    current = null;
    state = options.disposedState;
  };

  const subscribe = (value: TValue) => {
    current = value;
    subscription = options.state$(value).subscribe((next) => {
      state = next;
      cdr.markForCheck();
    });
  };

  inject(DestroyRef).onDestroy(dispose);

  return (value: TValue | null | undefined) => {
    if (!current && value) subscribe(value);

    if (current !== value) {
      dispose();
      if (value) subscribe(value);
    }

    return state;
  };
};
