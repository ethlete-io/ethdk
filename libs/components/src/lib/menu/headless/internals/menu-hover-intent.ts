import { Subscription, tap, timer } from 'rxjs';

export type MenuHoverIntent = {
  scheduleOpen: (callback: () => void, delay: number) => void;
  scheduleClose: (callback: () => void, delay: number) => void;
  cancelOpen: () => void;
  cancelClose: () => void;
  cancelAll: () => void;
  destroy: () => void;
};

/**
 * Holds the pending open/close timers a menu uses to interpret submenu hover intent.
 * One pending open and one pending close can exist at a time - scheduling replaces
 * the previous timer of the same kind.
 */
export const createMenuHoverIntent = (): MenuHoverIntent => {
  let openSubscription: Subscription | null = null;
  let closeSubscription: Subscription | null = null;

  const cancelOpen = () => {
    openSubscription?.unsubscribe();
    openSubscription = null;
  };

  const cancelClose = () => {
    closeSubscription?.unsubscribe();
    closeSubscription = null;
  };

  const cancelAll = () => {
    cancelOpen();
    cancelClose();
  };

  const scheduleOpen = (callback: () => void, delay: number) => {
    cancelOpen();
    openSubscription = timer(delay)
      .pipe(
        tap(() => {
          openSubscription = null;
          callback();
        }),
      )
      .subscribe();
  };

  const scheduleClose = (callback: () => void, delay: number) => {
    cancelClose();
    closeSubscription = timer(delay)
      .pipe(
        tap(() => {
          closeSubscription = null;
          callback();
        }),
      )
      .subscribe();
  };

  return {
    scheduleOpen,
    scheduleClose,
    cancelOpen,
    cancelClose,
    cancelAll,
    destroy: cancelAll,
  };
};
