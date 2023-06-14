import { Directive, ElementRef, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';

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

  @Input({ alias: 'etIsElement', transform: booleanAttribute })
  isElement = false;
}
