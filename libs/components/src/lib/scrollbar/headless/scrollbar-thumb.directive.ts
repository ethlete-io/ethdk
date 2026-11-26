import { DestroyRef, Directive, inject } from '@angular/core';
import { applyHostListener, injectHostElement } from '@ethlete/core';
import { ScrollbarDirective } from './scrollbar.directive';

/**
 * The part of a scrollbar that moves. Sizes and offsets itself from the scrollbar's geometry, and
 * starts a drag when it is pressed.
 *
 * @example
 * <div etScrollbar [for]="list">
 *   <div etScrollbarThumb></div>
 * </div>
 */
@Directive({
  selector: '[etScrollbarThumb]',
  host: {
    class: 'et-scrollbar-thumb',
  },
})
export class ScrollbarThumbDirective {
  private scrollbar = inject(ScrollbarDirective);
  private hostElement = injectHostElement();

  constructor() {
    this.scrollbar.thumbElement.set(this.hostElement);

    inject(DestroyRef).onDestroy(() => {
      if (this.scrollbar.thumbElement() !== this.hostElement) return;

      this.scrollbar.thumbElement.set(null);
    });

    applyHostListener('pointerdown', (event) => this.scrollbar.startThumbDrag(event));
  }
}
