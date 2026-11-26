import { Subscription, tap, timer } from 'rxjs';

export type Typeahead = {
  /** Appends a character to the buffer and returns the current query. */
  append: (character: string) => string;
  /** Whether a typeahead run is in progress, i.e. the buffer is not yet reset. */
  isRunning: () => boolean;
  reset: () => void;
  destroy: () => void;
};

export const createTypeahead = (resetDelay = 500): Typeahead => {
  let buffer = '';
  let resetSubscription: Subscription | null = null;

  const cancelReset = () => {
    resetSubscription?.unsubscribe();
    resetSubscription = null;
  };

  const reset = () => {
    cancelReset();
    buffer = '';
  };

  const append = (character: string) => {
    cancelReset();
    buffer += character.toLowerCase();
    resetSubscription = timer(resetDelay)
      .pipe(
        tap(() => {
          buffer = '';
          resetSubscription = null;
        }),
      )
      .subscribe();

    return buffer;
  };

  return {
    append,
    isRunning: () => buffer.length > 0,
    reset,
    destroy: reset,
  };
};
