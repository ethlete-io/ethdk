import { Directive } from '@angular/core';

export const SCROLL_OBSERVER_IGNORE_TARGET_CLASS = 'et-scroll-observer-ignore-target';

@Directive({
  selector: '[etScrollObserverIgnoreTarget]',
  standalone: true,
  host: {
    class: SCROLL_OBSERVER_IGNORE_TARGET_CLASS,
  },
})
export class ScrollObserverIgnoreTargetDirective {}
