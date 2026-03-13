import { Directive, ElementRef, inject } from '@angular/core';
import { ScrollObserverDirective } from './scroll-observer.directive';

@Directive({
  selector: '[etScrollObserverEnd]',
})
export class ScrollObserverEndDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private host = inject(ScrollObserverDirective);

  constructor() {
    this.host._registerEnd(this.elementRef);
  }
}
