import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { ScrollObserverDirective } from './scroll-observer.directive';

@Directive({
  selector: '[etScrollObserverStart]',
})
export class ScrollObserverStartDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private host = inject(ScrollObserverDirective);

  constructor() {
    inject(DestroyRef).onDestroy(this.host.registerStart(this.elementRef));
  }
}
