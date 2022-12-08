import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, HostBinding, Input } from '@angular/core';

export const SCROLL_OBSERVER_FIRST_ELEMENT_CLASS = 'et-scroll-observer-first-element';

@Directive({
  selector: '[etScrollObserverFirstElement]',
  standalone: true,
})
export class ScrollObserverFirstElementDirective {
  @Input('etScrollObserverFirstElement')
  @HostBinding(`class.${SCROLL_OBSERVER_FIRST_ELEMENT_CLASS}`)
  get isFirstElement(): boolean {
    return this._isFirstElement;
  }
  set isFirstElement(value: BooleanInput) {
    this._isFirstElement = coerceBooleanProperty(value);
  }
  private _isFirstElement = false;
}
