import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, ElementRef, InjectionToken, Input, inject } from '@angular/core';

export const IS_ACTIVE_ELEMENT = new InjectionToken<IsActiveElementDirective>('ET_IS_ACTIVE_ELEMENT');

@Directive({
  selector: '[etIsActiveElement]',
  standalone: true,
  providers: [
    {
      provide: IS_ACTIVE_ELEMENT,
      useExisting: IsActiveElementDirective,
    },
  ],
})
export class IsActiveElementDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input('etIsActiveElement')
  get isActiveElement(): boolean {
    return this._isActiveElement;
  }
  set isActiveElement(value: BooleanInput) {
    this._isActiveElement = coerceBooleanProperty(value);
  }
  private _isActiveElement = false;
}
