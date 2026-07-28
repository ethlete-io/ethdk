import { DOCUMENT, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, map } from 'rxjs';
import { memoizeSignal } from './signal-data-utils';

/**
 * A signal for whether this page is the one the reader is actually looking at — `false` for a backgrounded
 * tab or a minimised window.
 *
 * Not the same question as whether an element is on screen: an IntersectionObserver reports a fully visible
 * element in a background tab, because the tab's own visibility is no part of what it measures. Anything
 * that moves on its own needs to ask both, and a timer is not a substitute — browsers throttle timers in a
 * hidden tab rather than stopping them, so work keeps piling up out of sight.
 */
export const injectIsDocumentVisible = memoizeSignal<boolean>(() => {
  const document = inject(DOCUMENT);
  const isVisible = () => document.visibilityState === 'visible';

  return toSignal(fromEvent(document, 'visibilitychange').pipe(map(isVisible)), { initialValue: isVisible() });
});
