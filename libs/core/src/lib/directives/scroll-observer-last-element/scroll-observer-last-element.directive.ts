import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, HostBinding, Input } from '@angular/core';

export const SCROLL_OBSERVER_LAST_ELEMENT_CLASS = 'et-scroll-observer-last-element';

@Directive({
  selector: '[etScrollObserverLastElement]',
  standalone: true,
  host: {
    class: SCROLL_OBSERVER_LAST_ELEMENT_CLASS,
  },
})
export class ScrollObserverLastElementDirective {
  @Input('etScrollObserverLastElement')
  @HostBinding(`class.${SCROLL_OBSERVER_LAST_ELEMENT_CLASS}`)
  get isLastElement(): boolean {
    return this._isLastElement;
  }
  set isLastElement(value: BooleanInput) {
    this._isLastElement = coerceBooleanProperty(value);
  }
  private _isLastElement = false;
}
