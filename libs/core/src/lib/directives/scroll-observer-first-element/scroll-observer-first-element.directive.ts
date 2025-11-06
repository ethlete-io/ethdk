import { Directive, HostBinding, Input, booleanAttribute } from '@angular/core';

export const SCROLL_OBSERVER_FIRST_ELEMENT_CLASS = 'et-scroll-observer-first-element';

@Directive({
  selector: '[etScrollObserverFirstElement]',
  standalone: true,
})
export class ScrollObserverFirstElementDirective {
  @Input({ alias: 'etScrollObserverFirstElement', transform: booleanAttribute })
  @HostBinding(`class.${SCROLL_OBSERVER_FIRST_ELEMENT_CLASS}`)
  isFirstElement = false;
}
