import { Subscription, tap, timer } from 'rxjs';

export type MenuTypeahead = {
  /** Appends a character to the buffer and returns the current query. */
  append: (character: string) => string;
  reset: () => void;
  destroy: () => void;
};

export const createMenuTypeahead = (resetDelay = 500): MenuTypeahead => {
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
    reset,
    destroy: reset,
  };
};
