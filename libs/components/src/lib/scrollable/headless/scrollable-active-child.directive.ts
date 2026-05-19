import { DestroyRef, Directive, ElementRef, booleanAttribute, inject, input, linkedSignal } from '@angular/core';
import { ScrollableDirective } from './scrollable.directive';

@Directive({
  selector: '[etScrollableActiveChild]',
})
export class ScrollableActiveChildDirective {
  private scrollable = inject(ScrollableDirective, { optional: true });
  private destroyRef = inject(DestroyRef);

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  public isActiveChildEnabled = input(true, { alias: 'etScrollableActiveChild', transform: booleanAttribute });

  private isActiveChildEnabledSignal = linkedSignal(() => this.isActiveChildEnabled());

  constructor() {
    if (!this.scrollable) return;

    const ref = {
      elementRef: this.elementRef,
      isActiveChildEnabled: this.isActiveChildEnabledSignal,
    };

    this.destroyRef.onDestroy(() => {
      this.scrollable?.unregisterActiveChild(ref);
    });
  }
}
