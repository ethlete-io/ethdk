import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, ElementRef, InjectionToken, Input, inject } from '@angular/core';

export const IS_ELEMENT = new InjectionToken<IsElementDirective>('ET_IS_ELEMENT');

@Directive({
  selector: '[etIsElement]',
  standalone: true,
  providers: [
    {
      provide: IS_ELEMENT,
      useExisting: IsElementDirective,
    },
  ],
})
export class IsElementDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input('etIsElement')
  get isElement(): boolean {
    return this._isElement;
  }
  set isElement(value: BooleanInput) {
    this._isElement = coerceBooleanProperty(value);
  }
  private _isElement = false;
}
