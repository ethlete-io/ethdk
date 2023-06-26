import { Directive, ElementRef, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';

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

  @Input({ alias: 'etIsActiveElement', transform: booleanAttribute })
  isActiveElement = false;
}
