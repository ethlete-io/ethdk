import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { concat, filter, map, of, skip, switchMap, timer } from 'rxjs';

/**
 * How long after the last width change the container counts as settled. Matched to the default move duration:
 * shorter and a slow drag would animate between frames anyway, longer and the first move after a resize is
 * needlessly stiff.
 */
const RESIZE_SETTLE_MS = 150;

/**
 * Whether the container is in the middle of changing width, so moves can snap during a window drag and
 * animate again once the width holds still. The first measured width is not a resize.
 *
 * @internal
 */
export const useMasonryResizeSettled = (containerInlineSize: Signal<number>) =>
  toSignal(
    toObservable(containerInlineSize).pipe(
      filter((inlineSize) => inlineSize > 0),
      skip(1),
      switchMap(() => concat(of(true), timer(RESIZE_SETTLE_MS).pipe(map(() => false)))),
    ),
    { initialValue: false },
  );
