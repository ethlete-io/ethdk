import { DestroyRef, Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { ScrollableActiveChildRef, ScrollableDirective } from './scrollable.directive';

@Directive({
  selector: '[etScrollableActiveChild]',
})
export class ScrollableActiveChildDirective {
  private scrollable = inject(ScrollableDirective, { optional: true });
  private destroyRef = inject(DestroyRef);

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  public isActiveChildEnabled = input(true, { alias: 'etScrollableActiveChild', transform: booleanAttribute });

  constructor() {
    const scrollable = this.scrollable;

    if (!scrollable) return;

    const ref: ScrollableActiveChildRef = {
      elementRef: this.elementRef,
      isActiveChildEnabled: this.isActiveChildEnabled,
    };

    scrollable.registerActiveChild(ref);

    this.destroyRef.onDestroy(() => scrollable.unregisterActiveChild(ref));
  }
}
