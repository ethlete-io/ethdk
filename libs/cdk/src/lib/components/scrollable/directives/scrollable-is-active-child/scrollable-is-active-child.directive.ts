import { Directive, ElementRef, InjectionToken, Input, booleanAttribute, inject, signal } from '@angular/core';
import { signalHostAttributes } from '@ethlete/core';

export const SCROLLABLE_IS_ACTIVE_CHILD_TOKEN = new InjectionToken<ScrollableIsActiveChildDirective>(
  'SCROLLABLE_IS_ACTIVE_CHILD_TOKEN',
);

export const SCROLLABLE_IS_ACTIVE_CHILD_ATTRIBUTE = 'etScrollableIsActiveChild';

export const isScrollableChildActive = (e: HTMLElement) => {
  const attr = e.attributes.getNamedItem(SCROLLABLE_IS_ACTIVE_CHILD_ATTRIBUTE)?.value;

  return attr === 'true' || attr === '';
};

@Directive({
  selector: `[${SCROLLABLE_IS_ACTIVE_CHILD_ATTRIBUTE}]`,
  standalone: true,
  providers: [
    {
      provide: SCROLLABLE_IS_ACTIVE_CHILD_TOKEN,
      useExisting: ScrollableIsActiveChildDirective,
    },
  ],
})
export class ScrollableIsActiveChildDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ transform: booleanAttribute, alias: SCROLLABLE_IS_ACTIVE_CHILD_ATTRIBUTE })
  set _isActiveChildEnabled(v: boolean) {
    this.isActiveChildEnabled.set(v);
  }
  readonly isActiveChildEnabled = signal(true);

  readonly hostAttributeBindings = signalHostAttributes({
    [SCROLLABLE_IS_ACTIVE_CHILD_ATTRIBUTE]: this.isActiveChildEnabled,
  });
}
