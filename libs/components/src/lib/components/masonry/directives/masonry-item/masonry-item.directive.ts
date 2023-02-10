import { Directive, ElementRef, inject, InjectionToken } from '@angular/core';
import { MasonryDimensions } from '../../types';

export const MASONRY_ITEM_TOKEN = new InjectionToken<MasonryItemDirective>('ET_MASONRY_ITEM_DIRECTIVE');

@Directive({
  selector: '[etMasonryItem]',
  standalone: true,
  exportAs: 'etMasonryItem',
  host: {
    class: 'et-masonry-item',
  },
  providers: [{ provide: MASONRY_ITEM_TOKEN, useExisting: MasonryItemDirective }],
})
export class MasonryItemDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  resize(dimensions: MasonryDimensions) {
    const item = this._elementRef.nativeElement;

    const rowSpan = Math.ceil(
      (item.getBoundingClientRect().height + dimensions.rowGap) / (dimensions.rowHeight + dimensions.rowGap),
    );

    const newSpan = 'span ' + rowSpan;

    if (item.style.gridRowEnd === newSpan) {
      return;
    }

    item.style.gridRowEnd = newSpan;
  }
}
