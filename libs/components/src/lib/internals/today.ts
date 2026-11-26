import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectHostElement, injectIsDocumentVisible } from '@ethlete/core';
import { isSameDay, startOfDay } from 'date-fns';
import { filter, fromEvent } from 'rxjs';

/**
 * Today at local midnight, re-read from the clock when focus enters the host from outside it and when
 * the document becomes visible again. Runs no timer.
 */
export const injectToday = () => {
  const hostElement = injectHostElement();
  const isDocumentVisible = injectIsDocumentVisible();

  const focusEntry = toSignal(
    fromEvent<FocusEvent>(hostElement, 'focusin').pipe(
      filter((event) => !(event.relatedTarget instanceof Node && hostElement.contains(event.relatedTarget))),
    ),
  );

  return computed(
    () => {
      isDocumentVisible();
      focusEntry();

      return startOfDay(new Date());
    },
    { equal: isSameDay },
  );
};
