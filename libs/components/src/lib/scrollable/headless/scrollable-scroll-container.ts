import { ElementRef, InjectionToken, Signal } from '@angular/core';

export const SCROLLABLE_SCROLL_CONTAINER = new InjectionToken<Signal<ElementRef<HTMLElement> | null>>(
  'SCROLLABLE_SCROLL_CONTAINER',
);
