import { existsSync } from 'fs';
import { filter, interval, map, take, tap } from 'rxjs';

export const CHECKOUT_WATCH_MS = 10_000;

/** Why the resident of `target` must exit because its checkout or its entry file no longer exists, or `null`. */
export const checkoutGoneOf = (options: { target: string; entry: string | undefined }) => {
  if (!existsSync(options.target)) return `checkout ${options.target} is gone`;
  if (options.entry && !existsSync(options.entry)) return `entry ${options.entry} is gone`;

  return null;
};

/** Calls `onGone` with the reason once the checkout or the entry file is gone, checked every `everyMs`. */
export const watchCheckout = (options: {
  target: string;
  entry: string | undefined;
  onGone: (reason: string) => void;
  everyMs?: number;
}) => {
  return interval(options.everyMs ?? CHECKOUT_WATCH_MS)
    .pipe(
      map(() => checkoutGoneOf(options)),
      filter((reason): reason is string => reason !== null),
      take(1),
      tap((reason) => options.onGone(reason)),
    )
    .subscribe();
};
