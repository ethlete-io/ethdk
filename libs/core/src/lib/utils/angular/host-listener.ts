import { ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

export const createRxHostListener = <K extends keyof HTMLElementEventMap>(
  eventName: K,
  options?: EventListenerOptions,
) => {
  const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement as EventTarget;

  const observable = options
    ? fromEvent<HTMLElementEventMap[K]>(element, eventName, options)
    : fromEvent<HTMLElementEventMap[K]>(element, eventName);

  return observable.pipe(takeUntilDestroyed());
};

export const applyHostListener = <K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: EventListenerOptions,
) => createRxHostListener(eventName, options).subscribe(handler);

export const applyHostListeners = (
  listeners: Partial<{
    [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void;
  }>,
  options?: EventListenerOptions,
) => {
  for (const eventName in listeners) {
    const handler = listeners[eventName as keyof HTMLElementEventMap];

    if (handler) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyHostListener(eventName as keyof HTMLElementEventMap, handler as any, options);
    }
  }
};
