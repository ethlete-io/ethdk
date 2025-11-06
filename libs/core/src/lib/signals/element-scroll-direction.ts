import { DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { fromEvent, of, switchMap, tap } from 'rxjs';
import { SignalElementBindingType, buildElementSignal, firstElementSignal } from './element';

export type ElementLastScrollDirectionType = 'up' | 'down' | 'left' | 'right';

export type ElementLastScrollDirection = {
  type: ElementLastScrollDirectionType;
  time: number;
};

export const signalElementLastScrollDirection = (el: SignalElementBindingType) => {
  const elements = buildElementSignal(el);
  const element = firstElementSignal(elements);
  const destroyRef = inject(DestroyRef);
  const lastScrollDirection = signal<ElementLastScrollDirection | null>(null);

  let lastScrollTop = 0;
  let lastScrollLeft = 0;

  toObservable(element)
    .pipe(
      switchMap(({ currentElement }) => {
        if (!currentElement) {
          lastScrollDirection.set(null);
          lastScrollTop = 0;
          lastScrollLeft = 0;

          return of(null);
        }

        return fromEvent(currentElement, 'scroll').pipe(
          tap(() => {
            const { scrollTop, scrollLeft } = currentElement;
            const time = Date.now();

            if (scrollTop > lastScrollTop) {
              lastScrollDirection.set({ type: 'down', time });
            } else if (scrollTop < lastScrollTop) {
              lastScrollDirection.set({ type: 'up', time });
            } else if (scrollLeft > lastScrollLeft) {
              lastScrollDirection.set({ type: 'right', time });
            } else if (scrollLeft < lastScrollLeft) {
              lastScrollDirection.set({ type: 'left', time });
            }

            lastScrollTop = scrollTop;
            lastScrollLeft = scrollLeft;
          }),
        );
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return lastScrollDirection.asReadonly();
};

export const signalHostElementLastScrollDirection = () => signalElementLastScrollDirection(inject(ElementRef));
