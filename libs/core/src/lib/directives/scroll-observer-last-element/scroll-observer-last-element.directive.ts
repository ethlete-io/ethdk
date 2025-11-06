import { Directive, HostBinding, Input, booleanAttribute } from '@angular/core';

export const SCROLL_OBSERVER_LAST_ELEMENT_CLASS = 'et-scroll-observer-last-element';

@Directive({
  selector: '[etScrollObserverLastElement]',
  standalone: true,
  host: {
    class: SCROLL_OBSERVER_LAST_ELEMENT_CLASS,
  },
})
export class ScrollObserverLastElementDirective {
  @Input({ alias: 'etScrollObserverLastElement', transform: booleanAttribute })
  @HostBinding(`class.${SCROLL_OBSERVER_LAST_ELEMENT_CLASS}`)
  isLastElement = false;
}
