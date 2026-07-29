import { Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, filter, tap } from 'rxjs';

/**
 * How long after the last width change the container counts as settled. Matched to the default move duration:
 * shorter and a slow drag would animate between frames anyway, longer and the first move after a resize is
 * needlessly stiff.
 */
const RESIZE_SETTLE_MS = 150;

/**
 * Whether the container is in the middle of changing width.
 *
 * A window drag re-columns the masonry on every frame, and a move transition retargeted every frame is one
 * the items never finish — they trail behind the layout they belong to for as long as the drag lasts. So moves
 * snap while this is true and animate again once the width holds still.
 *
 * Debounced rather than framed: what matters is when the resizing *stops*, which nothing reports.
 *
 * @internal
 */
export const useMasonryResizeSettled = (containerInlineSize: Signal<number>) => {
  const isResizing = signal(false);

  toObservable(containerInlineSize)
    .pipe(
      // Zero is "not measured yet" — the first real width is not a resize.
      filter((inlineSize) => inlineSize > 0),
      tap(() => isResizing.set(true)),
      debounceTime(RESIZE_SETTLE_MS),
      tap(() => isResizing.set(false)),
      takeUntilDestroyed(),
    )
    .subscribe();

  return isResizing.asReadonly();
};
